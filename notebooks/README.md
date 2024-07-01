# cuda
```sh
sudo apt-key del 7fa2af80

cd ~/dwl
wget https://developer.download.nvidia.com/compute/cuda/repos/wsl-ubuntu/x86_64/cuda-wsl-ubuntu.pin
sudo mv cuda-wsl-ubuntu.pin /etc/apt/preferences.d/cuda-repository-pin-600
wget https://developer.download.nvidia.com/compute/cuda/12.0.0/local_installers/cuda-repo-wsl-ubuntu-12-0-local_12.0.0-1_amd64.deb
sudo dpkg -i cuda-repo-wsl-ubuntu-12-0-local_12.0.0-1_amd64.deb
sudo cp /var/cuda-repo-wsl-ubuntu-12-0-local/cuda-*-keyring.gpg /usr/share/keyrings/
sudo apt-get update
sudo apt-get -y install cuda

nvidia-smi
nvcc -V

```

# conda
```sh
cd ~/dwl
wget https://repo.anaconda.com/miniconda/Miniconda3-py310_23.1.0-1-Linux-x86_64.sh
chmod +x Miniconda3-py310_23.1.0-1-Linux-x86_64.sh
./Miniconda3-py310_23.1.0-1-Linux-x86_64.sh

```

# ml-experiments
```sh
mkdir -p ~/ws/ml
cd ~/ws/ml

# conda create --name ml-experiments
conda activate ml-experiments

conda install -y ipykernel
conda install -y pytorch torchvision torchaudio pytorch-cuda=11.7 -c pytorch -c nvidia
conda list

pip install torch

python --version
nvidia-smi
nvcc -V

python -c "import torch; print(torch.backends.cudnn.enabled)"
python -c "import torch; print(torch.cuda.is_available())"
python -m torch.utils.collect_env

```

# huggingface
* https://huggingface.co/docs/transformers/perf_train_gpu_one
```sh
conda install -c huggingface transformers

pip install transformers
pip install transformers[torch]
pip install jupyter ipywidgets

pip install transformers datasets accelerate nvidia-ml-py3

python -c "from transformers import pipeline"
python -c "from transformers import pipeline; print(pipeline('sentiment-analysis')('we love you'))"

```
