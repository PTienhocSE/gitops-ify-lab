#!/bin/bash
set -e

# Redirect stdout and stderr to a log file for debugging
exec > >(tee -i /var/log/user-data.log) 2>&1

echo "=== System update and utility installation ==="
apt-get update -y
apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release git unzip

echo "=== Installing Docker CE ==="
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io

# Enable and start Docker
systemctl enable docker
systemctl start docker

# Add ubuntu to docker group
usermod -aG docker ubuntu

# Wait for Docker socket to be ready
while ! docker info >/dev/null 2>&1; do
  echo "Waiting for Docker daemon to start..."
  sleep 1
done

echo "=== Installing kubectl ==="
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
rm kubectl

echo "=== Installing Minikube ==="
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
install minikube-linux-amd64 /usr/local/bin/minikube
rm minikube-linux-amd64

# Configure sysctl to bypass minikube root-check warning if needed
sysctl -w fs.protected_regular=0 || true

echo "=== Cloning Repository ==="
cd /home/ubuntu
su - ubuntu -c "git clone https://github.com/PTienhocSE/gitops-ify-lab.git /home/ubuntu/gitops-ify-lab"

echo "=== Starting Minikube as ubuntu user ==="
su - ubuntu -c "minikube start --driver=docker --memory=6000m --cpus=2"

echo "=== Minikube Status ==="
su - ubuntu -c "minikube status"

echo "=== Installation Completed ==="
