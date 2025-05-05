function label() {
  echo
  echo
  echo "--------------------------------------"
  echo ":: $1"
  echo "--------------------------------------"
  echo
}

# shellcheck disable=SC2164
cd "$(dirname "$0")"
# shellcheck disable=SC2155
export BUILD_ARG="prom"
export PROJECT_NAME="ecs-fargate-jmx-demo-$BUILD_ARG-app"

mvn clean install

platform=$DOCKER_PLATFORM

# shellcheck disable=SC2155
export ACCOUNT=$(aws sts get-caller-identity | jq .Account -r)
export ECR_URL=${ACCOUNT}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com


if [ -z "$platform" ]
then
  platform="amd64"
fi


function buildDocker(){
  (
    # cd $rootDir/$1/$1-service || exit
    docker build --build-arg PLATFORM=$platform -t "$ECR_URL/$PROJECT_NAME":latest -f ./Dockerfile-$BUILD_ARG .
    docker push "$ECR_URL/$PROJECT_NAME":latest
  )
}

label "Login to ECR"
aws ecr get-login-password --region "${AWS_DEFAULT_REGION}" | docker login --username AWS --password-stdin "$ECR_URL"

label "Package and push"
buildDocker

