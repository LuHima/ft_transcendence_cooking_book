#HashiCorp Configuration Language. dice a vault come comportarsi allavvio

storage "file" {
  path = "/vault/data"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = "true"
}

# The address other services use to reach this Vault instance
api_addr = "http://vault:8200"

# Enables the Vault CLI/API to query runtime info (not secret data)
disable_mlock = true

ui = true