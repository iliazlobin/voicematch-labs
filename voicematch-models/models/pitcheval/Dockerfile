# FROM 763104351884.dkr.ecr.us-east-1.amazonaws.com/tensorflow-inference:2.11.0-cpu-py39-ubuntu20.04-ec2
# FROM 763104351884.dkr.ecr.us-east-1.amazonaws.com/tensorflow-inference:2.11.0-cpu
FROM 763104351884.dkr.ecr.us-east-1.amazonaws.com/tensorflow-inference:2.11.1-cpu
# FROM 763104351884.dkr.ecr.us-east-1.amazonaws.com/huggingface-tensorflow-inference:2.11.1-transformers4.26.0-cpu-py39-ubuntu20.04

RUN pip install --no-cache-dir \
	numpy tensorflow tensorflow_hub pydub scipy

RUN curl -fsSL https://nginx.org/keys/nginx_signing.key | apt-key add -
RUN apt update
RUN apt install -y curl
RUN apt install -y ffmpeg espeak

# # # DEBUG
# # RUN apt install -y vim less curl

RUN apt clean

# COPY entrypoint.py /usr/local/bin/dockerd-entrypoint.py
# COPY model /opt/ml/export
# # COPY config/config.properties /opt/config.properties
# COPY config/log4j2.xml /opt/conda/lib/python3.9/site-packages/sagemaker_pytorch_serving_container/etc/log4j2.xml

# # ENV TS_CONFIG_FILE=/opt/config.properties
# ENV TS_DEFAULT_WORKERS_PER_MODEL=2
# ENV TS_DEFAULT_RESPONSE_TIMEOUT=10
# # ENV TS_LOAD_MODELS=ALL
# ENV TS_DECODE_INPUT_REQUEST=false
