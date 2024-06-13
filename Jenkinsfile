pipeline {
    agent any

    environment {
        NODE_VERSION = '20.x'
        APP_NAME = 'stampezze'
        APP_PORT = '3000'
        GITHUB_REPO = 'stampezee-backend'
        GITHUB_URL = 'https://github.com/anis-6883/stampezee-backend.git'
        DEPLOY_SERVER = '3.97.37.14'
        DEPLOY_USER = 'ubuntu'
        DEPLOY_PATH = '/var/www/html/'
        PRODUCTION_BRANCH = 'dev-tr'
        SERVER_FILE = "dist/index.js"
    }

    stages {
        stage('Setup Node.js and MongoDB') {
            steps {
                script {
                    sh '''
                    if ! command -v node > /dev/null; then
                        echo "Node.js is not installed. Installing Node.js..."
                        curl -sL https://deb.nodesource.com/setup_$NODE_VERSION | sudo -E bash -
                        sudo apt-get install -y nodejs
                    else
                        echo "Node.js is already installed."
                    fi

                    if ! command -v mongod > /dev/null; then
                        echo "MongoDB is not installed. Installing MongoDB..."
                        curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
                            sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg \
                            --dearmor
                        echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
                        sudo apt-get update
                        sudo apt-get install -y mongodb-org
                        sudo systemctl start mongod
                        sudo systemctl enable mongod
                    else
                        echo "MongoDB is already installed."
                    fi
                    '''
                }
            }
        }

        stage('Install PM2') {
            steps {
                script {
                    sh '''
                    if ! command -v pm2 > /dev/null; then
                        echo "PM2 is not installed. Installing PM2..."
                        npm install -g pm2
                    else
                        echo "PM2 is already installed."
                    fi
                    '''
                }
            }
        }

        stage('Prepare Project') {
            steps {
                script {
                    def repoPath = "${DEPLOY_PATH}/${GITHUB_REPO}"
                    def projectCloned = sh(script: "[ -d ${repoPath}/.git ] && echo 'true'", returnStdout: true).trim()
                    
                    if (projectCloned != 'true') {
                        sh """
                        echo "Cloning the project..."
                        cd ${DEPLOY_PATH}
                        git clone ${GITHUB_URL}
                        cd ${repoPath}
                        git checkout ${PRODUCTION_BRANCH}
                        """
                    } else {
                        sh """
                        echo "Project already cloned. Pulling latest changes..."
                        cd ${repoPath}
                        git pull origin ${PRODUCTION_BRANCH}
                        """
                    }
                }
            }
        }

        stage('Install Dependencies') {
            steps {
                script {
                    sh """
                    echo "Removing existing node_modules and installing dependencies..."
                    cd ${DEPLOY_PATH}
                    rm -rf node_modules
                    npm install
                    """
                }
            }
        }

        stage('Set Environment Variables') {
            steps {
                script {
                    sh """
                    echo "Setting environment variables..."
                    export APP_NAME=${APP_NAME}
                    export APP_PORT=${APP_PORT}
                    """
                }
            }
        }

        stage('Deploy Application') {
            steps {
                script {
                    def pm2ProcessRunning = sh(script: "pm2 list | grep ${APP_NAME}", returnStatus: true)
                    if (pm2ProcessRunning == 0) {
                        sh """
                        echo "Stopping running PM2 process..."
                        pm2 stop ${APP_NAME}
                        """
                    }

                    sh """
                    echo "Starting application with PM2..."
                    cd ${DEPLOY_PATH}
                    pm2 start ${SERVER_FILE} --name ${APP_NAME} -- --port ${APP_PORT}
                    """
                }
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            echo 'Deployment completed successfully.'
        }
        failure {
            echo 'Deployment failed.'
        }
    }
}
