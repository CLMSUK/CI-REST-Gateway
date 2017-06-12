docker build -t ci-gateway .
docker tag ci-gateway clmscidev.westeurope.cloudapp.azure.com:5000/ci-gateway
docker push clmscidev.westeurope.cloudapp.azure.com:5000/ci-gateway
