# Finvexa

Plataforma financeira com IA para dashboards, relatórios e compartilhamento seguro. **Seus números, decisões mais inteligentes.**

## Recursos

- Login com senha armazenada em hash.
- Lançamentos de despesas e receitas, vencimento, valor, situação e recorrência mensal.
- Painel mensal e grade anual semelhante à planilha.
- Importação `.xlsx`, incluindo o modelo baixável e o layout visual da imagem.
- MySQL em produção e SQLite para desenvolvimento local.

## Executar

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/flask --app app init-db
.venv/bin/flask --app app create-user seu@email.com
.venv/bin/flask --app app run --debug
```

Abra `http://127.0.0.1:5000`.

## MySQL

Crie o banco e o usuário, depois copie `.env.example` para `.env` e ajuste `DATABASE_URL`:

```sql
CREATE DATABASE financas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'financas'@'localhost' IDENTIFIED BY 'uma-senha-forte';
GRANT ALL PRIVILEGES ON financas.* TO 'financas'@'localhost';
```

Após isso, execute novamente `init-db` e `create-user`. Em produção, defina `SECRET_KEY` e `COOKIE_SECURE=true` no ambiente.

## Serviço permanente e domínio

Os arquivos em `deploy/` executam a aplicação com Gunicorn nas portas `5000` (todas as interfaces) e `5050` (localhost) e encaminham o domínio pelo Nginx. Para instalar o serviço, iniciar agora e habilitar a inicialização automática junto com o servidor, execute:

```bash
sudo install -m 644 /srv/compartilhada/Iago/projects/checkout/deploy/checkout.service /etc/systemd/system/checkout.service
sudo systemctl daemon-reload
sudo systemctl enable --now checkout.service
systemctl is-enabled checkout.service
systemctl status checkout.service --no-pager
```

O comando `is-enabled` deve retornar `enabled`, e o status deve mostrar `active (running)`. O serviço também reinicia automaticamente em caso de falha. Para consultar os logs, use `journalctl -u checkout.service -n 50 --no-pager`.

Inclua `deploy/nginx-location.conf` no virtual host de `checkout.chiapettadev.tech`.
