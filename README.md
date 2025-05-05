# jmx-for-ecs

## Deploy

```shell
export STACK_NAME=ecs-fargate-jmx-demo
cd cdk
cdk deploy ${STACK_NAME}-docker --require-approval never

cd ..
sh './apps/hello/build-otel.sh'
sh './apps/hello/build-prom.sh'

cd cdk
cdk deploy ${STACK_NAME}-infra --require-approval never
cdk deploy ${STACK_NAME}-app --require-approval never

```

## Clean up

```shell
cd cdk

cdk destroy --all --force

```
