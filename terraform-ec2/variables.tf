variable "aws_region" {
  description = "The AWS region to deploy resources in"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "The EC2 instance type"
  type        = string
  default     = "t3.large"
}

variable "project_name" {
  description = "Project name tag for tagging resources"
  type        = string
  default     = "w9-gitops-lab"
}
