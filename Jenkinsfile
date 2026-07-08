// =============================================================================
// ContaPRO - Jenkins CI/CD Pipeline
//
// Stages:
//   1. Quality & Security (paralelo): SonarQube + Checkov
//   2. Build Backend: imagen Docker con pnpm
//   3. Push to ECR: tags :latest y :<commit-sha>
//   4. Sync App Secrets: sube API keys a Secrets Manager si está vacío
//   5. Deploy Backend: ECS force-new-deployment
//   6. Build & Deploy Frontend: pnpm build → S3 sync → CloudFront invalidation
//
// Las migraciones de Prisma corren automáticamente en el entrypoint del
// contenedor al arrancar (ver backend-contapro/docker-entrypoint.sh).
//
// Todo se resuelve dinámicamente desde AWS — no requiere variables manuales.
//
// Requisitos en Jenkins:
//   - Plugins: Pipeline, Docker Pipeline, SonarQube Scanner, AWS Credentials
//   - Credenciales (Manage Jenkins > Credentials):
//       * aws-credentials        (AWS Access Key + Secret Key)
//       * sonarqube-token        (Secret text: token de SonarQube)
//       * contapro-app-secrets   (Secret text: JSON con API keys del backend)
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
                                        -Dsonar.exclusions=node_modules/**,dist/**,coverage/** \
                                        -Dsonar.coverage.exclusions=**/*
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
        // Stage 5: Sync App Secrets to Secrets Manager
        //
        // Sube las API keys y configuración del backend a Secrets Manager.
        // Solo actualiza si el secreto está vacío (primera vez tras terraform apply).
        // Las credenciales se guardan en Jenkins como "contapro-app-secrets".
        // =====================================================================
        stage('Sync App Secrets') {
            when {
                triggeredBy 'UserIdCause'
            }
            steps {
                withCredentials([[$class: 'AmazonWebServicesCredentialsBinding',
                                  credentialsId: 'aws-credentials',
                                  accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                                  secretKeyVariable: 'AWS_SECRET_ACCESS_KEY'],
                                 string(credentialsId: 'contapro-app-secrets', variable: 'APP_SECRETS_JSON')]) {
                    sh '''
                        SECRET_NAME="${PROJECT_NAME}-app-secrets-${ENVIRONMENT}"
                        echo "=== Verificando secreto ${SECRET_NAME} ==="

                        CURRENT=$(aws secretsmanager get-secret-value \
                            --secret-id "${SECRET_NAME}" \
                            --region ${AWS_REGION} \
                            --query SecretString \
                            --output text 2>/dev/null || echo "")

                        if [ -z "${CURRENT}" ] || [ "${CURRENT}" = "{}" ] || [ "${CURRENT}" = "null" ]; then
                            echo "Secreto vacío, subiendo configuración..."
                            aws secretsmanager put-secret-value \
                                --secret-id "${SECRET_NAME}" \
                                --secret-string "${APP_SECRETS_JSON}" \
                                --region ${AWS_REGION}
                            echo "=== Secretos sincronizados ==="
                        else
                            echo "=== Secreto ya tiene valores, no se sobreescribe ==="
                        fi
                    '''
                }
            }
        }

        // =====================================================================
        // Stage 6: Deploy Backend to ECS (force new deployment)
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

                            # --- Variables de CloudFront para links internos ---
                            CF_DOMAIN=$(aws cloudfront list-distributions --query \
                                "DistributionList.Items[?Origins.Items[?Id=='S3-${FRONTEND_BUCKET}']].DomainName | [0]" \
                                --output text --region us-east-1)
                            if [ -n "${CF_DOMAIN}" ] && [ "${CF_DOMAIN}" != "None" ]; then
                                export NEXT_PUBLIC_LANDING_HOST="https://${CF_DOMAIN}"
                                export NEXT_PUBLIC_APP_HOST="https://${CF_DOMAIN}"
                            fi

                            # --- Analytics (PostHog) ---
                            export NEXT_PUBLIC_POSTHOG_KEY="phc_nqpUSxcabs7dS8JHWMfwMIBlmgIh4w2fObQGaPTQBN5"
                            export NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"

                            echo "NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}"
                            echo "NEXT_PUBLIC_COGNITO_USER_POOL_ID=${NEXT_PUBLIC_COGNITO_USER_POOL_ID}"
                            echo "NEXT_PUBLIC_COGNITO_CLIENT_ID=${NEXT_PUBLIC_COGNITO_CLIENT_ID}"
                            echo "NEXT_PUBLIC_COGNITO_REGION=${NEXT_PUBLIC_COGNITO_REGION}"
                            echo "NEXT_PUBLIC_LANDING_HOST=${NEXT_PUBLIC_LANDING_HOST}"
                            echo "NEXT_PUBLIC_APP_HOST=${NEXT_PUBLIC_APP_HOST}"

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
