module "network" {
  source = "./modules/network"

  project_name         = var.project_name
  environment          = var.environment
  vpc_cidr             = "10.0.0.0/16"
  public_subnets_cidr  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnets_cidr = ["10.0.3.0/24", "10.0.4.0/24"]
  availability_zones   = ["${var.region}a", "${var.region}b"]
}

module "backend" {
  source = "./modules/backend"

  project_name       = var.project_name
  environment        = var.environment
  vpc_id             = module.network.vpc_id
  public_subnet_ids  = module.network.public_subnet_ids
  private_subnet_ids = module.network.private_subnet_ids
  alb_sg_id          = module.security.alb_sg_id
  ecs_sg_id          = module.security.ecs_sg_id
  container_port     = 8080
}

module "frontend" {
  source = "./modules/frontend"

  project_name = var.project_name
  environment  = var.environment
}

module "auth" {
  source = "./modules/auth"

  project_name = var.project_name
  environment  = var.environment
}

module "security" {
  source = "./modules/security"

  project_name   = var.project_name
  environment    = var.environment
  vpc_id         = module.network.vpc_id
  container_port = 8080 # Tu backend Node.js corre en el 8080
}