FROM 763104351884.dkr.ecr.us-west-2.amazonaws.com/djl-inference:0.21.0-deepspeed0.8.0-cu117

# DEBUG
RUN apt update
RUN apt install -y vim

EXPOSE 9080 9081
COPY config.properties /opt/djl/conf/config.properties
