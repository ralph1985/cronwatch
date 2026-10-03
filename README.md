# CronWatch

CronWatch recopila tareas de cron y timers systemd, consulta evidencias accesibles, las redacta para eliminar secretos y envía mediante Resend un informe diario centrado en las copias de seguridad.

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

Cada informe diario analiza la ventana `[día anterior 08:00, día actual 08:00)` en la zona horaria configurada. El correo organiza las copias de seguridad en cuatro grupos de proyectos —Vida personal y hogar (Jucart, Irati, A Punto y Mis Facturas), Eventos, grupos y participación (Kamikazes, loto-sync y encuesta-simple), Automatización y seguimiento (Ofertas Radar) y Datos personales y productividad (Obsidian y TickTick)— y una sección separada de Controles operativos (CronWatch y Google Drive). Cada grupo muestra un estado agregado: `FALLO` si algún elemento falla, `AVISOS` si hay avisos o falta evidencia y `OK` solo cuando todo está correcto. El estado del crontab se calcula por la existencia de una copia en esa ventana y el resto a partir de sus logs (`OK`, `FALLO`, `AVISOS` o `SIN EVIDENCIA`). Las fuentes no diarias se describen con su calendario actual: Jucart en días alternos del calendario a las 03:30; Irati los domingos a las 00:00; Kamikazes y encuesta-simple el día 1 de cada mes a las 02:00 y 03:00; Ofertas Radar los lunes a las 02:30; Obsidian los martes a las 02:30; A Punto los miércoles a las 02:30; Mis Facturas los jueves a las 02:30; loto-sync los domingos, martes y viernes a las 04:30; y TickTick los domingos a las 06:15. Google Drive continúa como réplica externa diaria comprobada a las 07:30. Cuando una fuente programada no tiene ejecuciones en la ventana, el informe explica que no se ejecuta a diario e indica la próxima copia prevista. La expresión de Jucart sigue la semántica de cron `*/2`: alterna los días del mes y reinicia el patrón al comenzar cada mes.

## Seguridad y límites

CronWatch no usa sudo. Las fuentes no legibles quedan marcadas en el informe. Codex recibe un paquete de evidencias ya recopilado y redactado, y se invoca en modo `read-only`. Los informes, evidencias y logs propios se conservan 30 días en `var/` y se eliminan después.

El proyecto excluye explícitamente su propio trabajo del inventario conceptual: el informe se centra en tareas externas a CronWatch.
