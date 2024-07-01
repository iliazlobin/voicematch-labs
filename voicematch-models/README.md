# install ipynb kernel
```sh
cd /root/ws/ml
# conda create --name pytorch-tf
conda activate pytorch-tf
python --version
# conda deactivate

conda install pytorch torchvision torchaudio pytorch-cuda=11.7 -c pytorch -c nvidia

# pip install torch torchvision torchaudio
python -c "import torch; print(torch. __version__)"
python -c "import torch; print(torch. __file__)"
python -c "import torch; print(torch.backends.cudnn.enabled)"
python -c "import torch; print(torch.cuda.is_available())"
python -c "import torch; print(torch.version.cuda)"

pip install tensorflow tensorflow_hub
python -c "import tensorflow; print(tensorflow. __version__)"

# conda search -c conda-forge tensorflow-gpu
# conda install -c conda-forge tensorflow-gpu
python -c "import tensorflow; print(tensorflow.config.list_physical_devices('GPU'))"

# conda search -c conda-forge cudatoolkit
# conda install -c conda-forge cudatoolkit
# conda install -c conda-forge cudatoolkit=11.7.0

# pip install --upgrade setuptools pip
# pip install nvidia-pyindex

# pip index versions nvidia-tensorrt
pip install nvidia-tensorrt
pip install nvidia-tensorrt==7.2.3.4
# export LD_LIBRARY_PATH=/root/miniconda3/envs/pytorch-tf/lib/python3.8/site-packages/tensorrt/:$LD_LIBRARY_PATH
python -c "import tensorrt; print(tensorrt.__version__); assert tensorrt.Builder(tensorrt.Logger())"

# conda install transformers
pip install transformers gradio datasets chardet cchardet librosa ipython sentencepiece plotly phonemizer


mkdir -p "/root/miniconda3/envs/pytorch-tf/etc/conda/activate.d/"
: > "/root/miniconda3/envs/pytorch-tf/etc/conda/activate.d/env_vars.sh"
echo "export OLD_LD_LIBRARY_PATH=${LD_LIBRARY_PATH}" >> "/root/miniconda3/envs/pytorch-tf/etc/conda/activate.d/env_vars.sh"
echo "export LD_LIBRARY_PATH=/root/miniconda3/envs/pytorch-py38/lib/python3.8/site-packages/tensorrt/:${LD_LIBRARY_PATH}" >> "/root/miniconda3/envs/pytorch-tf/etc/conda/activate.d/env_vars.sh"

mkdir -p "/root/miniconda3/envs/pytorch-tf/etc/conda/deactivate.d/"
: > "/root/miniconda3/envs/pytorch-tf/etc/conda/deactivate.d/env_vars.sh"
echo "export LD_LIBRARY_PATH=${OLD_LD_LIBRARY_PATH}" >> "/root/miniconda3/envs/pytorch-tf/etc/conda/deactivate.d/env_vars.sh"
echo "unset OLD_LD_LIBRARY_PATH" >> "/root/miniconda3/envs/pytorch-tf/etc/conda/deactivate.d/env_vars.sh"

# unset LD_LIBRARY_PATH
# export LD_LIBRARY_PATH=/root/miniconda3/envs/pytorch-py38/lib/python3.8/site-packages/tensorrt/:$LD_LIBRARY_PATH

# unset CUDA_VISIBLE_DEVICES
# export CUDA_VISIBLE_DEVICES=0

pip install transformers gradio datasets chardet cchardet librosa ipython music21 sentencepiece plotly phonemizer

conda install ffprobe

# sagemaker
pip install "sagemaker>=2.48.0" --upgrade

pip install fsspec s3fs

```

# voicematch-models build
```sh
cd /root/ws/ml/dlc

unset AWS_PROFILE
export AWS_PROFILE=iliazlobin-gpt
aws sts get-caller-identity

# docker pull 908060038426.dkr.ecr.us-east-1.amazonaws.com/amazonlinux:latest
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 908060038426.dkr.ecr.us-east-1.amazonaws.com

aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin 763104351884.dkr.ecr.us-west-2.amazonaws.com
docker pull 763104351884.dkr.ecr.us-west-2.amazonaws.com/djl-inference:0.21.0-deepspeed0.8.0-cu117

# docker-compose -f "/root/ws/ml/voicematch-models/docker-compose.yaml" up --build --abort-on-container-exit

# cd /root/ws/ml/voicematch-models/docker-huggingface
# docker build -t voicematch:huggingface .

# rm containers
docker container ls
docker rm $(docker stop $(docker ps -aq --filter ancestor=voicematch-wordrecog:latest --format="{{.ID}}"))

# build docker
cd /root/ws/ml/voicematch-models/models/wordrecog
docker build -t voicematch-wordrecog:latest .

# install scripts
docker run --rm --entrypoint /bin/bash -it voicematch-wordrecog:pytorch

pip install --no-cache-dir \
	datasets
apt install -y ffmpeg
apt clean

# test
aws s3 cp s3://sagemaker-us-east-1-908060038426/model/voicematch/voicematch-wordrecog.tar.gz dwl/voicematch-wordrecog.tar.gz
cd dwl
tar xvzf voicematch-wordrecog.tar.gz

```

# voicematch-models serving
* https://pytorch.org/serve/inference_api.html
```sh
# management
docker run --rm -it voicematch-wordrecog:latest
docker run --rm --entrypoint /bin/bash -it voicematch-wordrecog:latest
docker ps -q --filter ancestor=voicematch-wordrecog:latest --format="{{.ID}}" | tr -d '\n' | x
docker exec -it 013442b880e0ls bash

python /usr/local/bin/dockerd-entrypoint.py serve

# old
docker run --rm --entrypoint /bin/bash -it voicematch:pytorch
docker ps -q --filter ancestor=voicematch:pytorch --format="{{.ID}}" | tr -d '\n' | x
docker exec -it 2cb2ec5518c7 bash

# startup
export TS_CONFIG_FILE=/opt/config.properties
unset SAGEMAKER_MULTI_MODEL
export SAGEMAKER_MULTI_MODEL=true
unset TS_MODEL_STORE
export TS_MODEL_STORE=/opt/ml/models/wordrecog

python /usr/local/bin/dockerd-entrypoint.py serve
# python /usr/local/bin/dockerd-entrypoint.py torchserve --start --model-store /home/model-server/ --ts-config /home/model-server/config.properties
# python /usr/local/bin/dockerd-entrypoint.py torchserve --start --ts-config /home/model-server/config.properties --model-store /home/model-server/


torchserve --start --model-store /.sagemaker/ts/models --ts-config /etc/sagemaker-ts.properties --log-config /opt/conda/lib/python3.9/site-packages/sagemaker_pytorch_serving_container/etc/log4j2.xml --models model=/opt/ml/model
# java -Dmodel_server_home=/opt/conda/lib/python3.9/site-packages -Dlog4j.configurationFile=file:///opt/conda/lib/python3.9/site-packages/sagemaker_pytorch_serving_container/etc/log4j2.xml -Djava.io.tmpdir=/home/model-server/tmp -cp .:/opt/conda/lib/python3.9/site-packages/ts/frontend/* org.pytorch.serve.ModelServer --python /opt/conda/bin/python3.9 -f /etc/sagemaker-ts.properties -s /.sagemaker/ts/models -w /.sagemaker/ts/models -m model=/opt/ml/model

# configure
# vi /etc/sagemaker-ts.properties
vi /opt/config.properties
# vi /opt/log4j2.xml
vi /opt/conda/lib/python3.9/site-packages/sagemaker_pytorch_serving_container/etc/log4j2.xml

# vi /home/model-server/config.properties
vi /logs/config/20230308054131215-startup.cfg
# vi /etc/sagemaker-ts.properties
vi /opt/ml/model/code/inference.py

# vi /opt/conda/lib/python3.9/site-packages/sagemaker_inference/etc/log4j2.xml
vi /opt/conda/lib/python3.9/site-packages/sagemaker_pytorch_serving_container/etc/log4j2.xml

# vi /usr/local/bin/dockerd-entrypoint.sh

# docker cp /root/ws/ml/voicematch-models/model-v3.tar.gz 2cb2ec5518c7:/opt/ml/model/model-v3.tar.gz
# docker cp /root/ws/ml/voicematch-models/model-v3.tar.gz 2cb2ec5518c7:/opt/ml/model/model-v3b.tar.gz
# docker cp /root/ws/ml/voicematch-models/voicematch.tar.gz 2cb2ec5518c7:/opt/ml/model/voicematch.tar.gz
# docker cp /root/ws/ml/voicematch-models/voicematch-v4.tar.gz 2cb2ec5518c7:/opt/ml/model/voicematch-v4.tar.gz
docker cp /root/ws/ml/voicematch-models/voicematch-v3b.tar.gz 2cb2ec5518c7:/opt/ml/model/voicematch-v3b.tar.gz
docker cp /root/ws/ml/voicematch-models/voicematch-bin.tar.gz 2cb2ec5518c7:/opt/ml/model/voicematch-bin.tar.gz
docker cp /root/ws/ml/voicematch-models/model/code/inference.py 2cb2ec5518c7:/opt/ml/model/code/inference.py

cd /opt/ml/model/ && ls -la
tar xvfz voicematch-v3b.tar.gz
tar xvfz voicematch-bin.tar.gz
# ls /opt/ml/model/voicematch-v4.tar.gz

# predictions
docker cp /root/ws/ml/voicematch-models/data/hello-hello.ogg 013442b880e0:/opt/hello-hello.ogg

# api
curl -X OPTIONS http://localhost:8080
curl -X GET http://localhost:8080/models
curl -X GET http://localhost:8080/models/model

curl http://localhost:8080/predictions/model -T /opt/hello-hello.ogg
curl http://localhost:8080/predictions/model -T /root/ws/ml/voicematch-models/data/hello-hello.ogg

```
