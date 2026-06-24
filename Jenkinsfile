// =============================================================================
// ContaPRO - Jenkins CI/CD Pipeline
//
// Stages:
//   1. Quality & Security (paralelo): SonarQube + Checkov
//   2. Build Backend: imagen Docker con pnpm
//   3. Push to ECR: tags :latest y :<commit-sha>
//   4. Deploy Backend: ECS force-new-deployment
//   5. Database Migrations: ECS run-task con prisma migrate deploy
//   6. Build & Deploy Frontend: pnpm build → S3 sync → CloudFront invalidation
//
// Todo se resuelve dinámicamente desde AWS — no requiere variables manuales.
//
// Requisitos en Jenkins:
//   - Plugins: Pipeline, Docker Pipeline, SonarQube Scanner, AWS Credentials
//   - Credenciales (Manage Jenkins > Credentials):
//       * aws-credentials        (AWS Access Key + Secret Key)
//       * sonarqube-token        (Secret text: token de SonarQube)
//   - Configuración global:
//       * SonarQube server "SonarQube" (Manage Jenkins > System > SonarQube servers)
//       * SonarQube Scanner "SonarScanner" (Manage Jenkins > Tools)
// =============================================================================

pipeline {
    agent any

    environment {
        AWS_REGION       = 'us-east-2'
        PROJECT_NAME     = 'contapro'
        ENVIRONMENT      = 'dev'
        ECR_REPOSITORY   = "${PROJECT_NAME}-backend-${ENVIRONMENT}"
        ECS_CLUSTER      = "${PROJECT_NAME}-cluster-${ENVIRONMENT}"
        ECS_SERVICE      = "${PROJECT_NAME}-backend-service-${ENVIRONMENT}"
        FRONTEND_BUCKET  = "${PROJECT_NAME}-frontend-${ENVIRONMENT}"
        SCANNER_HOME     = tool 'SonarScanner'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
    }

    triggers {
        pollSCM('H/5 * * * *')
    }

    stages {
        // =====================================================================
        // Stage 1: Quality & Security (paralelo)
        // =====================================================================
        stage('Quality & Security') {
            parallel {
                stage('SonarQube Analysis') {
                    when {
                        anyOf {
                            changeset 'backend-contapro/**'
                            expression { return env.BRANCH_NAME == 'main' || env.BRANCH_NAME == 'develop' }
                        }
                    }
                    steps {
                        dir('backend-contapro') {
                            withSonarQubeEnv('SonarQube') {
                                sh '''
                                    ${SCANNER_HOME}/bin/sonar-scanner \
                                        -Dsonar.projectKey=contapro-backend \
                                        -Dsonar.projectName="ContaPRO Backend" \
                                        -Dsonar.sources=src \
                                        -Dsonar.language=ts \
                                        -Dsonar.sourceEncoding=UTF-8 \
                                        -Dsonar.typescript.lcov.reportPaths=coverage/lcov.info \
                                        -Dsonar.exclusions=node_modules/**,dist/**,coverage/**
                                '''
                            }
                        }
                    }
                }

                stage('Checkov Scan') {
                    when {
                        anyOf {
                            changeset 'infrastructure/**'
                            expression { return env.BRANCH_NAME == 'main' || env.BRANCH_NAME == 'develop' }
                        }
                    }
                    steps {
                        sh '''
                            export PATH="$HOME/.local/bin:$PATH"
                            mkdir -p infrastructure/results.xml
                            pip3 install --break-system-packages -q checkov
                            checkov \
                                -d infrastructure/ \
                                --framework terraform \
                                --output cli \
                                --output junitxml \
                                --output-file-path infrastructure/results.xml/ \
                                --soft-fail
                        '''
                    }
                    post {
                        always {
                            junit allowEmptyResults: true, testResults: 'infrastructure/results.xml/results_junitxml.xml'
                        }
                    }
                }
            }
        }

        stage('Quality Gate') {
            when {
                anyOf {
                    changeset 'backend-contapro/**'
                    expression { return env.BRANCH_NAME == 'main' || env.BRANCH_NAME == 'develop' }
                }
            }
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: false
                }
            }
        }

        // =====================================================================
        // Stage 3: Build Backend Docker Image
        // =====================================================================
        stage('Build Backend') {
            when {
                anyOf {
                    changeset 'backend-contapro/**'
                    triggeredBy 'UserIdCause'
                }
            }
            steps {
                dir('backend-contapro') {
                    sh "docker build -t ${ECR_REPOSITORY}:${GIT_COMMIT} -t ${ECR_REPOSITORY}:latest ."
                }
            }
        }

        // =====================================================================
        // Stage 4: Push to ECR
        // =====================================================================
        stage('Push to ECR') {
            when {
                anyOf {
                    changeset 'backend-contapro/**'
                    triggeredBy 'UserIdCause'
                }
            }
            steps {
                withCredentials([[$class: 'AmazonWebServicesCredentialsBinding',
                                  credentialsId: 'aws-credentials',
                                  accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                                  secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {
                    sh '''
                        ECR_REGISTRY=$(aws sts get-caller-identity --query Account --output text).dkr.ecr.${AWS_REGION}.amazonaws.com
                        aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}
                        docker tag ${ECR_REPOSITORY}:${GIT_COMMIT} ${ECR_REGISTRY}/${ECR_REPOSITORY}:${GIT_COMMIT}
                        docker tag ${ECR_REPOSITORY}:latest ${ECR_REGISTRY}/${ECR_REPOSITORY}:latest
                        docker push ${ECR_REGISTRY}/${ECR_REPOSITORY}:${GIT_COMMIT}
                        docker push ${ECR_REGISTRY}/${ECR_REPOSITORY}:latest
                    '''
                }
            }
        }

        // =====================================================================
        // Stage 5: Deploy Backend to ECS
        // =====================================================================
        stage('Deploy Backend') {
            when {
                anyOf {
                    changeset 'backend-contapro/**'
                    triggeredBy 'UserIdCause'
                }
            }
            steps {
                withCredentials([[$class: 'AmazonWebServicesCredentialsBinding',
                                  credentialsId: 'aws-credentials',
                                  accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                                  secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {
                    sh '''
                        aws ecs update-service \
                            --cluster ${ECS_CLUSTER} \
                            --service ${ECS_SERVICE} \
                            --force-new-deployment \
                            --region ${AWS_REGION} \
                            --no-cli-pager

                        echo "Esperando a que el servicio se estabilice..."
                        aws ecs wait services-stable \
                            --cluster ${ECS_CLUSTER} \
                            --services ${ECS_SERVICE} \
                            --region ${AWS_REGION}
                    '''
                }
            }
        }

        // =====================================================================
        // Stage 6: Database Migrations (prisma migrate deploy via ECS run-task)
        //
        // Ejecuta las migraciones de Prisma dentro de la VPC usando la misma
        // imagen Docker del backend. Obtiene la task definition y la network
        // configuration del servicio ECS desplegado.
        // =====================================================================
        stage('Database Migrations') {
            when {
                anyOf {
                    changeset 'backend-contapro/**'
                    triggeredBy 'UserIdCause'
                }
            }
            steps {
                withCredentials([[$class: 'AmazonWebServicesCredentialsBinding',
                                  credentialsId: 'aws-credentials',
                                  accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                                  secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {
                    sh '''
                        echo "=== Obteniendo configuración del servicio ECS ==="
                        TASK_DEF=$(aws ecs describe-services \
                            --cluster ${ECS_CLUSTER} \
                            --services ${ECS_SERVICE} \
                            --region ${AWS_REGION} \
                            --query "services[0].taskDefinition" \
                            --output text)
                        echo "Task Definition: ${TASK_DEF}"

                        SUBNETS=$(aws ecs describe-services \
                            --cluster ${ECS_CLUSTER} \
                            --services ${ECS_SERVICE} \
                            --region ${AWS_REGION} \
                            --query "services[0].networkConfiguration.awsvpcConfiguration.subnets" \
                            --output json)

                        SECURITY_GROUPS=$(aws ecs describe-services \
                            --cluster ${ECS_CLUSTER} \
                            --services ${ECS_SERVICE} \
                            --region ${AWS_REGION} \
                            --query "services[0].networkConfiguration.awsvpcConfiguration.securityGroups" \
                            --output json)

                        CONTAINER_NAME=$(aws ecs describe-task-definition \
                            --task-definition "${TASK_DEF}" \
                            --region ${AWS_REGION} \
                            --query "taskDefinition.containerDefinitions[0].name" \
                            --output text)

                        echo "=== Ejecutando prisma migrate deploy ==="
                        TASK_ARN=$(aws ecs run-task \
                            --cluster ${ECS_CLUSTER} \
                            --task-definition "${TASK_DEF}" \
                            --launch-type FARGATE \
                            --network-configuration "awsvpcConfiguration={subnets=${SUBNETS},securityGroups=${SECURITY_GROUPS},assignPublicIp=DISABLED}" \
                            --overrides "{\"containerOverrides\":[{\"name\":\"${CONTAINER_NAME}\",\"command\":[\"npx\",\"prisma\",\"migrate\",\"deploy\"]}]}" \
                            --region ${AWS_REGION} \
                            --query "tasks[0].taskArn" \
                            --output text \
                            --no-cli-pager)
                        echo "Migration Task: ${TASK_ARN}"

                        echo "Esperando a que la migración termine..."
                        aws ecs wait tasks-stopped \
                            --cluster ${ECS_CLUSTER} \
                            --tasks "${TASK_ARN}" \
                            --region ${AWS_REGION}

                        EXIT_CODE=$(aws ecs describe-tasks \
                            --cluster ${ECS_CLUSTER} \
                            --tasks "${TASK_ARN}" \
                            --region ${AWS_REGION} \
                            --query "tasks[0].containers[0].exitCode" \
                            --output text)
                        echo "Migration exit code: ${EXIT_CODE}"

                        if [ "${EXIT_CODE}" != "0" ]; then
                            echo "=== ERROR: Migración falló. Logs: ==="
                            TASK_ID=$(echo "${TASK_ARN}" | awk -F'/' '{print $NF}')
                            aws logs get-log-events \
                                --log-group-name "/ecs/${PROJECT_NAME}-backend-${ENVIRONMENT}" \
                                --log-stream-name "ecs/${CONTAINER_NAME}/${TASK_ID}" \
                                --region ${AWS_REGION} \
                                --query "events[*].message" \
                                --output text 2>/dev/null || true
                            exit 1
                        fi

                        echo "=== Migraciones aplicadas exitosamente ==="
                    '''
                }
            }
        }

        // =====================================================================
        // Stage 7: Build & Deploy Frontend
        //
        // Obtiene dinámicamente desde AWS:
        //   - NEXT_PUBLIC_API_BASE       (API Gateway endpoint)
        //   - NEXT_PUBLIC_COGNITO_*      (User Pool ID, Client ID, Region)
        // =====================================================================
        stage('Deploy Frontend') {
            when {
                anyOf {
                    changeset 'front-contapro/**'
                    triggeredBy 'UserIdCause'
                }
            }
            steps {
                dir('front-contapro') {
                    withCredentials([[$class: 'AmazonWebServicesCredentialsBinding',
                                      credentialsId: 'aws-credentials',
                                      accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                                      secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {
                        sh '''
                            # --- Obtener variables del backend dinámicamente desde AWS ---
                            API_NAME="${PROJECT_NAME}-api-${ENVIRONMENT}"
                            export NEXT_PUBLIC_API_BASE=$(aws apigatewayv2 get-apis \
                                --region ${AWS_REGION} \
                                --query "Items[?Name=='${API_NAME}'].ApiEndpoint | [0]" \
                                --output text)

                            POOL_NAME="${PROJECT_NAME}-user-pool-${ENVIRONMENT}"
                            POOL_ID=$(aws cognito-idp list-user-pools --max-results 20 \
                                --region ${AWS_REGION} \
                                --query "UserPools[?Name=='${POOL_NAME}'].Id | [0]" \
                                --output text)
                            export NEXT_PUBLIC_COGNITO_USER_POOL_ID="${POOL_ID}"
                            export NEXT_PUBLIC_COGNITO_REGION="${AWS_REGION}"

                            if [ "${POOL_ID}" != "None" ] && [ -n "${POOL_ID}" ]; then
                                export NEXT_PUBLIC_COGNITO_CLIENT_ID=$(aws cognito-idp list-user-pool-clients \
                                    --user-pool-id "${POOL_ID}" \
                                    --region ${AWS_REGION} \
                                    --query "UserPoolClients[0].ClientId" \
                                    --output text)
                            fi

                            echo "NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}"
                            echo "NEXT_PUBLIC_COGNITO_USER_POOL_ID=${NEXT_PUBLIC_COGNITO_USER_POOL_ID}"
                            echo "NEXT_PUBLIC_COGNITO_CLIENT_ID=${NEXT_PUBLIC_COGNITO_CLIENT_ID}"
                            echo "NEXT_PUBLIC_COGNITO_REGION=${NEXT_PUBLIC_COGNITO_REGION}"

                            # --- Build ---
                            pnpm install --frozen-lockfile
                            pnpm run build

                            # --- Deploy a S3 ---
                            aws s3 sync ./out "s3://${FRONTEND_BUCKET}" --delete --region ${AWS_REGION}

                            # --- Invalidar caché de CloudFront ---
                            DIST_ID=$(aws cloudfront list-distributions --query \
                                "DistributionList.Items[?Origins.Items[?Id=='S3-${FRONTEND_BUCKET}']].Id" \
                                --output text --region us-east-1)

                            if [ -n "$DIST_ID" ] && [ "$DIST_ID" != "None" ]; then
                                aws cloudfront create-invalidation \
                                    --distribution-id "$DIST_ID" \
                                    --paths "/*" \
                                    --no-cli-pager
                            fi
                        '''
                    }
                }
            }
        }
    }

    post {
        success {
            echo "Pipeline completado exitosamente en rama ${env.BRANCH_NAME}"
        }
        failure {
            echo "Pipeline FALLÓ en rama ${env.BRANCH_NAME}"
        }
        cleanup {
            deleteDir()
        }
    }
}
