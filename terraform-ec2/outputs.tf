output "public_ip" {
  description = "The public IP of the EC2 instance"
  value       = aws_instance.k8s_node.public_ip
}

output "ssh_command" {
  description = "The SSH command to connect to the EC2 instance"
  value       = "ssh -i w9-lab-key.pem -o StrictHostKeyChecking=no ubuntu@${aws_instance.k8s_node.public_ip}"
}

output "argocd_url" {
  description = "The URL to access ArgoCD Web UI"
  value       = "http://${aws_instance.k8s_node.public_ip}:8080"
}

output "prometheus_url" {
  description = "The URL to access Prometheus Web UI"
  value       = "http://${aws_instance.k8s_node.public_ip}:9090"
}
