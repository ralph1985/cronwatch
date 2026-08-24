# CronWatch

CronWatch recopila tareas de cron y timers systemd, consulta evidencias accesibles, las redacta para eliminar secretos, las analiza con el CLI local de Codex y envía un informe diario mediante Resend.

## Configuración

```bash
cp .env.example .env.local
chmod 600 .env.local
pnpm install
pnpm run verify-codex
```

Completa `RESEND_API_KEY`, `RESEND_FROM` con un remitente verificado en Resend y `REPORT_TO` con una o varias direcciones separadas por comas o saltos de línea.

## Ejecución

```bash
pnpm run collect
pnpm start
pnpm run install:cron
```

`install:cron` modifica el crontab del usuario únicamente cuando se ejecuta explícitamente. La tarea se instala por defecto a las 08:00 en `Europe/Madrid`. Si Resend falla, el informe queda en `var/pending/` y se reenvía en la siguiente ejecución correcta.

La instalación también añade una tarea diaria a la 01:00 (`Europe/Madrid`) que guarda el crontab completo en `var/backups/crontab/`, con permisos privados y retención de 90 días. El informe marca esta copia como `OK` o `AVISOS`. Para restaurar una copia: `crontab var/backups/crontab/crontab-AAAA-MM-DD_HH-mm-ss.txt`.

Cada informe diario analiza la ventana `[día anterior 08:00, día actual 08:00)` en la zona horaria configurada. El correo comienza con una tabla de copias de seguridad de CronWatch, Jucart, Irati, encuesta-simple, Kamikazes, loto-sync y Ofertas Radar; el estado del crontab se calcula por la existencia de una copia en esa ventana y el resto a partir de sus logs (`OK`, `FALLO`, `AVISOS` o `SIN EVIDENCIA`).

## Seguridad y límites

CronWatch no usa sudo. Las fuentes no legibles quedan marcadas en el informe. Codex recibe un paquete de evidencias ya recopilado y redactado, y se invoca en modo `read-only`. Los informes, evidencias y logs propios se conservan 30 días en `var/` y se eliminan después.

El proyecto excluye explícitamente su propio trabajo del inventario conceptual: el informe se centra en tareas externas a CronWatch.
