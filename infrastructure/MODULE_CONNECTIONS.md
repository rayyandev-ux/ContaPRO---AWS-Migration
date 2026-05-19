# Mapa de Conexiones entre Módulos

## Diagrama de Dependencias

```
module.network (outputs: vpc_id, public_subnet_ids, private_subnet_ids)
       │
       ├──▶ module.security (inputs: vpc_id)
       │         └── outputs: alb_sg_id, ecs_sg_id, aurora_sg_id, redis_sg_id
       │
       ├──▶ module.backend (inputs: vpc_id, public_subnet_ids, private_subnet_ids)
       │
       ├──▶ module.database (inputs: private_subnet_ids)
       │         └── outputs: aurora_endpoint, db_credentials_secret_arn
       │
       └──▶ module.cache (inputs: private_subnet_ids)
                 └── outputs: redis_endpoint, redis_port, redis_url
```

## module.backend recibe conexiones de 5 módulos

```hcl
module "backend" {
  vpc_id             = module.network.vpc_id
  public_subnet_ids  = module.network.public_subnet_ids
  private_subnet_ids = module.network.private_subnet_ids
  alb_sg_id          = module.security.alb_sg_id
  ecs_sg_id          = module.security.ecs_sg_id
  uploads_bucket_name = module.storage.uploads_bucket_id
  uploads_bucket_arn  = module.storage.uploads_bucket_arn
  db_credentials_secret_arn = module.database.db_credentials_secret_arn
  redis_url                 = module.cache.redis_url
}
```

## module.database recibe conexiones de 2 módulos

```hcl
module "database" {
  private_subnet_ids = module.network.private_subnet_ids
  aurora_sg_id      = module.security.aurora_sg_id
}
```

## module.cache recibe conexiones de 2 módulos

```hcl
module "cache" {
  private_subnet_ids = module.network.private_subnet_ids
  redis_sg_id       = module.security.redis_sg_id
}
```

## module.security recibe conexiones de 1 módulo

```hcl
module "security" {
  vpc_id         = module.network.vpc_id
  container_port = 8080
}
```
