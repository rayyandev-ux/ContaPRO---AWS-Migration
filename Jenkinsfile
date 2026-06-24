// =============================================================================
// ContaPRO - Jenkins CI/CD Pipeline
//
// Stages:
//   1. Quality & Security (paralelo): SonarQube + Checkov
//   2. Build Backend: imagen Docker con pnpm
//   3. Push to ECR: tags :latest y :<commit-sha>
//   4. Deploy Backend: ECS force-new-deployment
//   5. Build & Deploy Frontend: pnpm build → S3 sync → CloudFront invalidation
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
                // --- SonarQube: análisis estático del código TypeScript ---
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

                // --- Checkov: escaneo de seguridad de la infraestructura Terraform ---
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

        // --- SonarQube Quality Gate: bloquea si no pasa el umbral ---
        stage('Quality Gate') {
            when {
                anyOf {
                    changeset 'backend-contapro/**'
                    expression { return env.BRANCH_NAME == 'main' || env.BRANCH_NAME == 'develop' }
                }
            }
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
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
        // Stage 6: Build & Deploy Frontend
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
                            pnpm install --frozen-lockfile
                            pnpm run build

                            aws s3 sync ./out "s3://${FRONTEND_BUCKET}" --delete --region ${AWS_REGION}

                            DIST_ID=$(aws cloudfront list-distributions --query \
                                "DistributionList.Items[?Origins.Items[?Id=='S3-${FRONTEND_BUCKET}']].Id" \
                                --output text --region us-east-1)

                            if [ -n "$DIST_ID" ]; then
                                aws cloudfront create-invalidation \
                                    --distribution-id "$DIST_ID" \
                                    --paths "/*" \
                                    --no-cli-pager
                            fi
                        '''
                    }
                }
            }
            // Las variables NEXT_PUBLIC_* se configuran en Jenkins:
            // Manage Jenkins > System > Global properties > Environment variables
            // - NEXT_PUBLIC_API_BASE
            // - NEXT_PUBLIC_COGNITO_USER_POOL_ID
            // - NEXT_PUBLIC_COGNITO_CLIENT_ID
            // - NEXT_PUBLIC_COGNITO_REGION
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
