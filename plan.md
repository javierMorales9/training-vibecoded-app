# Plan de producto - Desencadenado

## 1. Propósito

Construir una aplicación web personal, optimizada para móvil, que permita:

1. Consultar el catálogo de variantes de ejercicios y su material audiovisual.
2. Evaluar periódicamente las capacidades del usuario.
3. Planificar y ordenar entrenamientos futuros.
4. Guiar la realización de un entrenamiento en tiempo real.
5. Conservar y consultar el historial y la progresión.
6. Exponer mediante una API pública una selección limitada de capacidades para futuras integraciones y agentes de IA.

El libro sirve como fuente inicial del catálogo y de algunos programas, pero la aplicación no debe quedar acoplada a un único plan de entrenamiento.

### Principio permanente: una instalación, una persona

- Cada despliegue pertenece a una sola persona.
- No habrá multitenancy, organizaciones, invitaciones, roles ni cuentas compartidas.
- No se añadirán campos `user_id` ni capas de aislamiento pensando en un futuro multiusuario hipotético.
- La configuración y los niveles actuales pertenecen implícitamente al propietario de la instalación.
- La aplicación se ejecutará como una única instancia conectada a un único fichero SQLite.
- No se diseñará para escalado horizontal.
- Si otra persona quiere utilizarla, recibirá otro despliegue con su propia base de datos, almacenamiento y credenciales.

## 2. Forma de trabajo

El diseño se cerrará por fases. No se avanzará a la siguiente hasta revisar y aprobar la anterior.

| Fase | Resultado | Estado |
|---|---|---|
| 1. Alcance funcional y vocabulario | Lista completa de funciones, flujos y decisiones abiertas | Completada |
| 2. Modelo de dominio | Entidades, relaciones, invariantes y máquinas de estado | Completada |
| 3. Persistencia | Tablas SQLite, claves, índices, migraciones y estrategia de archivos | Completada |
| 4. Contrato de API | Recursos, operaciones, autenticación, errores y OpenAPI | Completada |
| 5. Arquitectura y proyecto | Dependencias, estructura del proyecto y despliegue | Completada |
| 6. Plan de implementación | Entregas verticales, pruebas y criterios de finalización | En revisión |

Este documento es vivo. Las propuestas no aprobadas se marcan como **por decidir**.

---

# Fase 1 - Alcance funcional y vocabulario

## 3. Vocabulario propuesto

El vocabulario debe distinguir el movimiento definido en el catálogo, lo que se planifica y lo que realmente hace el usuario.

| Término | Significado |
|---|---|
| **Tipo de ejercicio** | Familia principal: flexión, flexión vertical, dominada, sentadilla, abdominales o cuerpo completo. |
| **Variante** | Movimiento concreto que puede seleccionarse y ejecutarse: flexión clásica, dominada asistida, plancha, burpees, etc. Es el elemento principal del catálogo. |
| **Entrenamiento** | Plan de trabajo editable que puede estar pendiente en una cola ordenada. |
| **Bloque** | Unidad ordenada dentro de un entrenamiento. Define una metodología y contiene una o varias variantes. |
| **Metodología** | Forma de realizar un bloque: series normales, pirámide, superset, etc. |
| **Serie** | Realización física concreta y medible de una variante. Puede tener repeticiones, duración, carga adicional y resultado real. |
| **Ronda** | Agrupación repetible de trabajo dentro de un bloque. |
| **Sesión** | Realización real de un entrenamiento, desde que se inicia hasta que se completa o cancela. |
| **Evaluación** | Test periódico completo de las cinco capacidades principales. |
| **Resultado de nivel** | Resultado superado o fallido de un nivel concreto dentro de una evaluación. |

Todo el código, el esquema de base de datos y la API utilizarán nombres en inglés. Correspondencia inicial:

| Producto/UI | Código |
|---|---|
| Tipo de ejercicio | `ExerciseType` |
| Variante | `ExerciseVariant` |
| Entrenamiento | `Workout` |
| Bloque | `WorkoutBlock` |
| Metodología | `TrainingMethod` |
| Serie | `WorkoutSet` |
| Ronda | `Round` |
| Sesión | `WorkoutSession` |
| Evaluación | `Assessment` |
| Resultado de nivel | `AssessmentLevelResult` |

### Decisión propuesta sobre “ejecución”

Usar **bloque** en la planificación y **serie** para la acción física concreta.

Ejemplos:

- Un bloque de series normales contiene una variante y genera varias series.
- Un bloque de pirámide contiene una variante y genera una serie por peldaño.
- Un bloque de superset contiene exactamente dos variantes. Cada pareja se completa como una sola unidad de trabajo.

Esto evita usar “ejercicio” para tres conceptos distintos.

## 4. Propietario de la instalación

### Alcance permanente

- Existe un único propietario implícito por instalación.
- La interfaz requiere una contraseña porque estará publicada en Internet, no porque existan diferentes cuentas dentro de la aplicación.
- La API utiliza credenciales independientes y revocables pertenecientes al mismo propietario.
- Los datos de dominio no necesitan indicar a qué usuario pertenecen.
- La aplicación no incluye gestión de cuentas, invitaciones, organizaciones ni roles.

La contraseña de la interfaz se define en una variable de entorno. No existe gestión, recuperación ni cambio de contraseña dentro de la aplicación.

## 5. Catálogo de variantes

### 5.1 Lista y búsqueda

La unidad mostrada en la lista es la **variante**, no el ejercicio principal.

Funciones:

- Listar todas las variantes.
- Búsqueda de texto por nombre y descripción.
- Filtrar por uno o varios tipos de ejercicio.
- Filtrar por dificultad mínima y máxima.
- Combinar texto y filtros.
- Limpiar filtros.
- Mostrar nombre, tipo, rango de dificultad y una miniatura representativa.
- Indicar si existen más imágenes o vídeos.
- Mantener los filtros en la URL para poder volver, recargar o compartir una búsqueda.
- Mostrar todas las variantes cuando no haya texto ni filtros activos.
- Cargar más resultados mediante scroll infinito, sin paginación visible ni selector de página.
- Estado vacío cuando no hay resultados.

La dificultad se representa como un intervalo inclusivo:

- Nivel fijo: mínimo 3, máximo 3.
- Rango: mínimo 3, máximo 4.
- Sin nivel asignado: ambos valores ausentes.

Propuesta de comportamiento del filtro: una variante aparece cuando su intervalo se solapa con el intervalo elegido por el usuario.

### 5.2 Detalle de variante

- Abrir el detalle sin abandonar el contexto de la lista.
- Mostrar nombre, tipo, dificultad, descripción completa y medios asociados.
- Galería navegable de imágenes y vídeos.
- Ampliar una imagen o reproducir un vídeo.
- Navegación anterior/siguiente mediante controles visibles; teclado cuando exista teclado.
- Cierre del modal que devuelve el foco y el scroll a la lista.
- URL identificable para poder abrir directamente una variante.

### 5.3 API del catálogo

- Listar y filtrar variantes.
- Obtener el detalle de una variante.
- Obtener tipos de ejercicio y niveles disponibles.
- Devolver imágenes y vídeos mediante URLs utilizables por clientes externos.

La edición del catálogo queda fuera del primer MVP. Inicialmente se carga desde los datos extraídos del libro.

## 6. Evaluaciones de capacidades

El “test inicial” del libro pasa a llamarse **evaluación de capacidades**, porque podrá repetirse periódicamente.

### 6.1 Categorías evaluadas

Propuesta inicial:

1. Flexión.
2. Flexión vertical.
3. Dominada.
4. Sentadilla.
5. Abdominales.

Los ejercicios de cuerpo completo no forman parte de la evaluación inicial.

Cada categoría tiene cinco niveles ordenados y un criterio de superación. El criterio puede medirse en repeticiones o segundos, según la variante.

### 6.2 Historial de evaluaciones

- Listar evaluaciones por fecha, de más reciente a más antigua.
- Distinguir en curso, completada y cancelada.
- Mostrar un resumen del nivel alcanzado en cada categoría.
- Abrir un modal de detalle con todos los resultados de nivel.
- Mostrar niveles superados y el resultado no superado, si existe.
- Mostrar la cantidad lograda y la cantidad requerida.
- Mostrar duración total y notas opcionales.
- Destacar la evaluación más reciente, que determina los niveles de referencia actuales.

### 6.3 Inicio de una evaluación

- Botón “Nueva evaluación”.
- Si no existe una evaluación previa, cada categoría comienza en nivel 1.
- Si existe, cada categoría comienza en `máximo nivel superado anteriormente - 1`, con mínimo 1.
- El nivel inicial se calcula de forma independiente para cada categoría.
- Al empezar se guarda un borrador para poder recuperar la evaluación si se cierra la página.

### 6.4 Flujo por categoría

Para cada nivel presentado:

1. Se muestra la variante, su criterio de superación, descripción y medios.
2. El usuario indica si ha superado el nivel.
3. Si lo supera, se registra el éxito y se avanza al siguiente nivel.
4. Si supera el nivel 5, la categoría finaliza en nivel 5.
5. Si no lo supera, debe introducir el resultado real alcanzado; se registra el fallo y finaliza esa categoría.
6. Se continúa con la siguiente categoría.

Cuando terminan las cinco categorías, la evaluación se marca como completada y actualiza los niveles de referencia.

### 6.5 Comportamiento confirmado

- Si se falla el primer nivel presentado, se conserva el fallo sin inventar que se han vuelto a superar niveles inferiores.
- Los resultados históricos nunca se recalculan si posteriormente cambia un criterio.
- Una evaluación incompleta no modifica los niveles de referencia.
- Una evaluación cancelada se conserva para auditoría, pero tampoco modifica los niveles de referencia.
- Debe poder reanudarse una evaluación en curso.

### 6.6 Evaluación frente a entrenamiento

Decisión confirmada: mantener la evaluación como flujo y agregado de dominio separado del entrenamiento.

La evaluación no se adapta limpiamente al entrenamiento: ramifica por éxito/fallo, termina cada categoría al fallar, calcula niveles de referencia y no tiene la estructura normal de bloques, series y descansos. Forzar ambos conceptos produciría muchos estados y campos que sólo tendrían sentido para uno de los dos. Pueden compartir componentes de interfaz o temporización sin compartir entidad ni flujo.

### 6.7 API de evaluaciones

- Listar evaluaciones.
- Consultar una evaluación y sus resultados de nivel.
- Consultar los niveles de referencia actuales.

La API de evaluaciones es estrictamente de solo lectura. Crear, avanzar, reanudar, completar o cancelar una evaluación es exclusivo de la interfaz de la aplicación.

## 7. Planificación de entrenamientos

### 7.1 Cola de pendientes

- Lista ordenada de entrenamientos pendientes.
- Crear, editar, duplicar y eliminar un entrenamiento pendiente.
- Reordenar la cola.
- Ver un resumen: nombre, número de bloques, duración estimada y metodologías utilizadas.
- Abrir el detalle completo.
- Botón para iniciar un entrenamiento.
- No se incluye calendario en el primer MVP.

### 7.2 Composición de un entrenamiento

Un entrenamiento contiene bloques ordenados. Cada bloque define:

- Nombre opcional.
- Metodología.
- Una o varias variantes.
- Objetivo de trabajo: series/rondas y repeticiones o tiempo.
- Descanso previsto.
- Instrucciones o notas opcionales.

Metodologías iniciales propuestas:

1. **Series normales:** una variante y varias series que comparten el mismo objetivo planificado. Cada serie puede registrar un resultado real distinto y opcional.
2. **Pirámide:** una variante y una secuencia explícita de peldaños/repeticiones.
3. **Superset:** exactamente dos variantes realizadas seguidas y completadas como una única unidad, con descanso después de la pareja.

No se tendrán en cuenta otras metodologías ni se condicionará el diseño para admitirlas en el futuro.

### 7.3 Selección dinámica de nivel

Al planificar una variante de las cinco categorías evaluables se podrá elegir:

- Una variante concreta.
- Nivel actual de la última evaluación.
- Nivel actual + 1.
- Nivel actual - 1.

La referencia dinámica se resuelve a una variante concreta al iniciar la sesión. La sesión guarda esa resolución para que el historial no cambie aunque después se haga otra evaluación.

Si no existe evaluación previa, la aplicación debe pedir que se resuelva el conflicto antes de iniciar. Los desplazamientos se limitan al rango 1-5: nivel 1 menos 1 sigue siendo 1, y nivel 5 más 1 sigue siendo 5, como establece el libro.

### 7.4 API de planificación

- Listar y consultar pendientes.
- Crear, editar, duplicar y eliminar pendientes.
- Reordenar la cola de forma atómica.
- Añadir, editar, eliminar y reordenar bloques.
- Validar que el entrenamiento se puede iniciar.

## 8. Modo entrenamiento

### 8.1 Inicio

- Al iniciar un entrenamiento pendiente se crea una sesión.
- Se resuelven las referencias dinámicas de nivel.
- Se genera una instantánea de bloques, variantes, objetivos y descansos.
- Los cambios posteriores en el catálogo o en el entrenamiento no alteran la sesión.
- Un entrenamiento iniciado desaparece de pendientes y pasa a “en curso”.

### 8.2 Pantalla de trabajo

- Diseño mobile-first y controles grandes.
- Mostrar bloque, variante actual, metodología, objetivo e instrucciones.
- Acceso a la descripción y medios de la variante.
- Mostrar progreso dentro del bloque y del entrenamiento.
- Botón “Iniciar serie”.
- Cronómetro visible mientras la serie está activa.
- Botón “Finalizar serie”.
- Al finalizar se puede preguntar por el resultado real, pero responder es opcional y se puede avanzar sin hacerlo.
- El entrenamiento no se puede editar una vez iniciada la sesión.

### 8.3 Descanso

- Al finalizar una serie se inicia el descanso previsto cuando corresponda.
- Cuenta atrás visible.
- Aviso sonoro al llegar a cero.
- El usuario puede iniciar antes de tiempo o continuar descansando después del aviso.
- El descanso real se mide desde el final de una serie hasta el inicio de la siguiente.
- Se guardan tanto el objetivo como el tiempo real.
- El sonido se puede silenciar desde la sesión o desde preferencias.

### 8.4 Supersets

- Un superset contiene exactamente dos variantes.
- Las dos se realizan seguidas y sin descanso entre ellas.
- La interfaz ofrece un único inicio y una única finalización para la pareja completa; no hay un botón independiente por variante.
- La pareja se considera una sola serie o unidad de trabajo a efectos de progreso.
- El cronómetro activo cubre la realización de ambas variantes.
- Tras completar la pareja comienza el descanso.
- El descanso por defecto del programa del libro es de un minuto entre supersets.
- Al completar el número previsto de supersets se avanza al siguiente bloque.

Esta regla sigue la definición del libro: dos ejercicios con las repeticiones prescritas, sin descanso entre ellos, y un minuto de descanso entre cada superset.

### 8.5 Persistencia y recuperación

- Guardar cada transición importante inmediatamente.
- Los cronómetros se calculan a partir de marcas temporales persistidas, no de un contador exclusivamente visual.
- Si se recarga o cierra el navegador, la sesión se puede reanudar en el estado correcto.
- La aplicación debe manejar que el móvil bloquee la pantalla.
- Se intentará mantener la pantalla despierta durante la sesión cuando el navegador lo permita.

El modo completamente offline queda fuera del primer MVP.

### 8.6 Finalización y cancelación

- Completar la sesión al terminar todas las unidades previstas.
- Cancelar en cualquier momento, solicitando confirmación.
- Nota o motivo de cancelación opcional.
- Una sesión cancelada se conserva en el historial.
- Mostrar porcentaje completado, tiempo activo, tiempo de descanso y tiempo total.

Fórmula confirmada: `unidades de trabajo completadas / unidades de trabajo planificadas`. Una serie normal o un peldaño de pirámide cuenta como una unidad. La pareja completa de un superset cuenta como una única unidad.

### 8.7 Exclusión de la API pública

El modo entrenamiento es exclusivo de la interfaz. La API pública no puede iniciar, consultar, controlar, completar ni cancelar una sesión activa. Las reglas y transiciones se validarán en las operaciones internas usadas por la interfaz.

## 9. Historial de entrenamientos

- Listar sesiones completadas y canceladas.
- Filtrar por fecha, estado y tipo de ejercicio incluido.
- Mostrar duración, porcentaje completado y resumen de trabajo.
- Abrir detalle con bloques, rondas, series, tiempos y descansos.
- Comparar objetivo y resultado real.
- Mostrar las variantes concretas utilizadas, aunque la planificación usara un nivel dinámico.
- Añadir notas de sesión.
- Consultar el origen: entrenamiento y evaluación usada para resolver niveles.

### API de historial

- Listar y filtrar sesiones.
- Obtener el detalle completo de una sesión.
- Consultar series y descansos registrados.
- Obtener resúmenes básicos de progresión.

Los gráficos avanzados de progreso quedan fuera del primer MVP.

## 10. API pública

La API pública es deliberadamente más limitada que la interfaz. Comparte las mismas reglas para las operaciones que expone, pero no replica todas las capacidades de la aplicación.

### Principios

- API versionada desde el inicio bajo `/api/v1`.
- JSON como formato principal.
- Contrato OpenAPI generado o mantenido junto a la implementación.
- Identificadores estables que no dependan del nombre visible.
- Fechas en UTC y presentación en la zona horaria configurada.
- Paginación por cursor en colecciones que puedan crecer. La interfaz puede consumirla como scroll infinito sin mostrar páginas.
- Errores estructurados y códigos HTTP correctos.
- Validación de entrada compartida con los casos de uso de la interfaz.
- Clave de idempotencia para mutaciones susceptibles de repetirse por reintentos de un agente.

### Autenticación propuesta

- Interfaz web: contraseña definida en una variable de entorno y sesión mediante cookie segura.
- API: tokens revocables del propietario almacenados de forma segura.
- Permisos iniciales: lectura y escritura.
- Mostrar el token una sola vez al crearlo.
- Registrar último uso y permitir revocación.

### Cobertura

La API pública cubrirá:

- Catálogo: lectura.
- Evaluaciones y niveles actuales: sólo lectura.
- Entrenamientos y cola de pendientes: consulta, creación, edición, duplicación, eliminación y reordenación.
- Historial de sesiones terminadas o canceladas: sólo lectura.

La API pública no puede:

- Crear ni modificar evaluaciones o resultados de nivel.
- Iniciar un entrenamiento.
- Consultar o controlar una sesión activa.
- Registrar series, descansos o resultados durante una sesión.
- Completar o cancelar una sesión.

Las operaciones administrativas internas, migraciones y gestión directa de archivos no formarán parte de la API pública.

## 11. Archivos y medios

### Desarrollo y primer MVP local

- Imágenes en el directorio local existente.
- La base de datos conserva un identificador de medio y una referencia de almacenamiento, no una ruta absoluta del ordenador.
- Los vídeos externos se conservan como URL.

### Producción

- Imágenes en almacenamiento compatible con S3.
- La aplicación guarda clave de objeto, tipo MIME y metadatos; la URL pública o firmada se construye en la capa de almacenamiento.
- La transición de local a S3 no debe cambiar el modelo del catálogo ni el contrato de la API.

La subida y edición de medios desde la interfaz queda fuera del primer MVP.

## 12. Ajustes y operaciones mínimas

- Zona horaria del usuario.
- Activar/desactivar sonido.
- Valores de descanso por defecto.
- Gestión de tokens de API.
- Exportación completa de los datos personales en un formato portable.
- Estrategia documentada de copia y restauración de SQLite antes del despliegue real.

La contraseña de acceso no forma parte de los ajustes: se cambia modificando la variable de entorno y reiniciando el servicio.

### Copia y restauración de SQLite en Railway

Decisión: el fichero SQLite vivirá en un volumen montado, por ejemplo, en `/app/data`. Se podrá transferir desde o hacia el volumen mediante dos mecanismos soportados por Railway:

1. `railway volume files upload/download`, como mecanismo preferente para operar directamente sobre el volumen.
2. `scp` o SFTP contra `ssh.railway.com`, apuntando a la ruta montada dentro del contenedor.

La restauración seguirá estas reglas:

- Utilizar únicamente una copia consistente creada mediante el mecanismo de backup de SQLite, no una copia arbitraria del fichero mientras está siendo escrito.
- Validar localmente la copia antes de subirla.
- Subir inicialmente con un nombre temporal dentro del volumen.
- Detener la aplicación o colocarla en un estado de mantenimiento antes de sustituir la base activa.
- Conservar temporalmente la base anterior como rollback.
- Sustituir el fichero, tratar correctamente los archivos WAL/SHM y reiniciar el servicio.
- Ejecutar una comprobación de integridad y verificar la versión de las migraciones antes de volver a habilitar la aplicación.

Los comandos exactos y el procedimiento de rollback se documentarán en el runbook de despliegue. No se construirá una interfaz de restauración dentro de la aplicación.

## 13. Requisitos no funcionales del MVP

- Interfaz mobile-first y usable también en escritorio.
- Navegación accesible y controles utilizables durante el esfuerzo físico.
- Recuperación segura tras recarga o pérdida momentánea de conexión.
- Operaciones críticas transaccionales.
- Historial inmutable en los aspectos que describen lo ocurrido.
- Pruebas de las máquinas de estado de evaluación y entrenamiento.
- Copias de seguridad antes de migraciones destructivas.
- Registro de errores sin incluir tokens ni información sensible.

## 14. Fuera del primer MVP

- Calendario y programación por fecha.
- Notificaciones push.
- Funcionamiento completamente offline.
- Múltiples usuarios, roles, entrenadores o datos compartidos. Estas capacidades no pertenecen al producto; otra persona utilizaría otro despliegue.
- Edición completa del catálogo desde la UI.
- Importación automática de nuevos libros o programas.
- Gráficos avanzados y recomendaciones automáticas.
- Integraciones con wearables.
- Sincronización con calendarios externos.

## 15. Matriz resumida UI/API

| Área | Interfaz | API pública |
|---|---|---|
| Catálogo | Lista, filtros, detalle y galería | Lista, filtros, detalle y medios |
| Evaluaciones | Historial, asistente, reanudación y detalle | Sólo consulta de evaluaciones y niveles actuales |
| Entrenamientos pendientes | Crear, editar, ordenar, duplicar e iniciar | Gestión excepto inicio de sesión |
| Modo entrenamiento | Cronómetros, descansos, sonido y cancelación | No disponible |
| Historial | Lista, filtros y detalle | Consulta de sesiones, series y descansos |
| Ajustes | Preferencias y tokens | Gestión limitada de credenciales propias |

## 16. Registro de decisiones de esta fase

| # | Decisión | Estado |
|---:|---|---|
| 1 | Usar bloque, serie, ronda y sesión; usar nombres de código en inglés. | Confirmada |
| 2 | La evaluación cubre únicamente las cinco categorías principales. | Confirmada |
| 3 | Mantener evaluación y entrenamiento como flujos de dominio separados. | Confirmada |
| 4 | Preguntar por el resultado real de una serie, permitiendo omitirlo y avanzar. | Confirmada |
| 5 | Las series normales comparten un objetivo planificado; los resultados reales son individuales y opcionales. | Confirmada para el MVP |
| 6 | Superset: dos variantes sin descanso entre ellas y un minuto por defecto después de la pareja, según el libro. | Confirmada |
| 7 | Porcentaje basado en unidades completadas; la pareja de un superset cuenta como una unidad. | Confirmada |
| 8 | Contraseña de la interfaz en una variable de entorno. | Confirmada |
| 9 | Una sesión activa no se edita sobre la marcha. | Confirmada |
| 10 | La API no puede iniciar ni controlar sesiones activas. | Confirmada |
| 11 | Restaurar SQLite transfiriendo una copia validada al volumen mediante Railway CLI o SCP/SFTP, con la aplicación detenida y posibilidad de rollback. | Confirmada |

---

# Fases posteriores - Esqueleto

## 17. Fase 2 - Modelo de dominio

### 17.1 Principios del dominio

- Los nombres canónicos del código estarán en inglés; los textos de interfaz estarán en español.
- El modelo representa una única persona implícita. Ninguna entidad necesita propietario o `userId`.
- Las reglas de dominio no dependerán de React, TanStack Start, SQLite ni Railway.
- Los identificadores serán opacos y estables; su formato se decidirá en la fase de persistencia.
- Los hechos históricos conservan una instantánea de lo planificado y de lo realizado.
- Una referencia al catálogo identifica el movimiento, pero una sesión no depende de que el catálogo permanezca sin cambios.
- Evaluaciones y sesiones de entrenamiento son agregados independientes.
- Sólo existirán tres metodologías: series normales, pirámide y superset.

Un **agregado** es el conjunto de objetos que se modifica de forma consistente en una sola operación. El objeto superior indicado abajo controla sus reglas internas.

### 17.2 Mapa de agregados

```text
Catálogo
├── ExerciseVariant
│   └── MediaAsset
└── CapabilityLevelDefinition

Assessment
└── CapabilityAssessment
    └── AssessmentLevelResult

Workout
└── WorkoutBlock
    ├── ExerciseSelection
    └── MethodConfig

WorkoutSession
└── SessionBlockSnapshot
    ├── WorkUnit
    │   └── WorkUnitItem
    ├── PyramidStep
    └── RestPeriod

Acceso API
└── ApiToken
```

### 17.3 Valores compartidos

#### `DifficultyRange`

- `minimum`: nivel 1-5 o ausente.
- `maximum`: nivel 1-5 o ausente.
- Ambos deben existir o estar ausentes.
- Si existen, `minimum <= maximum`.

#### `Measurement`

Representa un valor medible con:

- Tipo: `REPETITIONS` o `DURATION_SECONDS`.
- Valor numérico no negativo.
- Ámbito opcional: total, por lado, por mano o por pierna.
- Etiqueta opcional para requisitos compuestos, por ejemplo “brazos extendidos”.

#### `Target`

Objetivo planificado compuesto por uno o varios requisitos medibles. Permite representar:

- 10 repeticiones.
- 6-8 repeticiones.
- 45 segundos.
- Un criterio compuesto, como tiempo colgado con brazos extendidos y con brazos flexionados.

#### `OrderedPosition`

Posición entera dentro de una colección ordenada. El dominio exige orden único y continuo; la persistencia decidirá cómo actualizarlo eficientemente.

### 17.4 Catálogo

#### `ExerciseType`

Clasificación cerrada:

- `PUSH_UP`
- `VERTICAL_PUSH_UP`
- `PULL_UP`
- `SQUAT`
- `CORE`
- `FULL_BODY`

#### `ExerciseVariant`

Movimiento seleccionable del catálogo.

Responsabilidades y datos:

- Identidad estable y slug.
- Nombre y descripción.
- `ExerciseType`.
- `DifficultyRange`.
- Medios ordenados.
- Indicador de disponibilidad; una variante usada históricamente no se elimina físicamente.

No contiene estado del usuario, resultados ni reglas de una metodología.

#### `MediaAsset`

- Tipo `IMAGE` o `VIDEO`.
- Posición dentro de la galería.
- Texto alternativo o descripción opcional.
- Referencia de almacenamiento:
  - Clave local durante el desarrollo.
  - Clave de objeto S3 para imágenes en producción.
  - URL externa para vídeos.
- Metadatos técnicos como MIME cuando apliquen.

La URL servida no forma parte permanente del dominio; se resuelve desde la referencia de almacenamiento.

#### `Capability`

Capacidades evaluables, separadas de `ExerciseType` aunque exista correspondencia directa:

- `PUSH_UP`
- `VERTICAL_PUSH_UP`
- `PULL_UP`
- `SQUAT`
- `CORE`

`FULL_BODY` no es una capacidad evaluable.

#### `CapabilityLevelDefinition`

Define qué significa evaluar un nivel:

- `Capability`.
- Nivel exacto 1-5.
- Variante que debe realizarse.
- Criterio de avance (`Target`).
- Instrucciones opcionales.
- Versión o identidad estable de la definición.

Debe existir exactamente una definición activa para cada combinación de capacidad y nivel. La dificultad general de una variante y su nivel dentro de una evaluación son conceptos distintos.

### 17.5 Evaluaciones

#### `Assessment`

Raíz de una evaluación completa.

Datos principales:

- Estado: `IN_PROGRESS`, `COMPLETED` o `CANCELLED`.
- Fecha de inicio y, cuando corresponda, finalización o cancelación.
- Cinco elementos `CapabilityAssessment`, uno por capacidad.
- Notas opcionales.

Una evaluación se crea directamente en curso y se persiste antes de presentar el primer nivel. Sólo puede existir una evaluación `IN_PROGRESS` a la vez.

#### `CapabilityAssessment`

Progreso de una capacidad dentro de la evaluación:

- Capacidad.
- Nivel de referencia anterior, si existía.
- Nivel inicial calculado y congelado al crear la evaluación.
- Estado: `NOT_STARTED`, `IN_PROGRESS` o `COMPLETED`.
- Nivel máximo resultante al terminar.
- Resultados de nivel ordenados.

Regla de inicio:

- Sin evaluación completada anterior: nivel 1.
- Con evaluación anterior: `max(1, previousMaximumLevel - 1)`.

#### `AssessmentLevelResult`

Resultado de presentar un nivel concreto:

- Nivel y capacidad.
- Referencia a la variante y copia del nombre mostrado.
- Copia del criterio exigido en ese momento.
- Resultado declarado: `PASSED` o `FAILED`.
- Mediciones reales; obligatorias cuando se declara fallo y opcionales cuando se declara éxito.
- Fecha de respuesta.

El criterio se copia para que un cambio posterior en el catálogo no reescriba el historial.

#### Significado de “nivel máximo”

El criterio del libro determina si se avanza al nivel siguiente. El nivel máximo de una evaluación es el último nivel intentado, incluso si no se alcanzó su criterio de avance. Por ejemplo, realizar flexiones clásicas sin alcanzar las repeticiones exigidas mantiene el nivel máximo en el nivel de flexión clásica.

Por tanto:

- Fallar el criterio termina esa capacidad y fija como máximo el nivel intentado.
- Superar el criterio permite intentar el siguiente nivel.
- Superar el nivel 5 fija el máximo en 5.
- No se inventan resultados aprobados para niveles inferiores que no se presentaron.

#### Máquina de estados de `Assessment`

1. `startAssessment` crea las cinco progresiones y sus niveles iniciales.
2. `recordPassedLevel` registra el éxito y presenta el nivel siguiente, o completa la capacidad si era nivel 5.
3. `recordFailedLevel` exige las mediciones reales y completa la capacidad en ese nivel.
4. Al completar una capacidad se activa la siguiente.
5. Al completar las cinco, la evaluación pasa a `COMPLETED` y sus máximos se convierten en niveles de referencia actuales.
6. `cancelAssessment` pasa a `CANCELLED`; sus resultados permanecen visibles pero no actualizan referencias.
7. Una evaluación terminal no admite nuevos resultados ni cambios factuales.

La posición actual se puede derivar de las progresiones, aunque podrá persistirse como cursor por eficiencia.

#### `CurrentCapabilityLevel`

Vista derivada con el nivel máximo de cada capacidad en la evaluación completada más reciente. No constituye una segunda fuente de verdad independiente.

Se utiliza para resolver selectores `CURRENT`, `CURRENT_PLUS_ONE` y `CURRENT_MINUS_ONE`, limitando siempre el resultado al intervalo 1-5.

### 17.6 Entrenamientos

#### `Workout`

Plan editable que ocupa una posición en la cola de pendientes.

Datos principales:

- Nombre.
- Notas opcionales.
- Posición en la cola.
- Estado: `PENDING` o `CONSUMED`.
- Uno o más bloques ordenados.
- Fechas de creación y última modificación.

Reglas:

- Sólo un `Workout` pendiente se puede editar, reordenar, duplicar o eliminar.
- Iniciar una sesión consume el entrenamiento de forma atómica.
- Un entrenamiento consumido no vuelve a la cola automáticamente.
- Duplicar crea una nueva identidad y una copia editable al final de la cola.

#### `WorkoutBlock`

Unidad ordenada del entrenamiento:

- Identidad dentro del entrenamiento.
- Posición.
- Nombre e instrucciones opcionales.
- Metodología discriminante.
- Configuración válida únicamente para esa metodología.

Un bloque no mezcla metodologías.

#### `ExerciseSelection`

Selecciona la variante de dos formas excluyentes:

1. `EXPLICIT_VARIANT`: referencia directa a una variante.
2. `CAPABILITY_RELATIVE`: capacidad y desplazamiento `-1`, `0` o `+1` respecto al nivel actual.

La selección relativa sólo puede utilizar una de las cinco capacidades. Se resuelve al iniciar la sesión y se limita a los niveles 1-5. Si todavía no existe evaluación completada, el entrenamiento no puede iniciarse hasta reemplazar o resolver esa selección.

#### `NormalSetsConfig`

- Una selección de ejercicio.
- Número de series mayor que cero.
- Un objetivo compartido por todas las series.
- Descanso previsto entre series.
- Instrucciones opcionales.

#### `PyramidConfig`

- Una selección de ejercicio.
- Duración total planificada.
- Repeticiones iniciales, normalmente 1.
- Regla de progresión ascendente/descendente.
- Segundos de descanso por repetición, normalmente 1 y opcionalmente 2.
- Instrucciones opcionales.

La cima no se conoce al planificar: la determina el rendimiento durante la sesión. Al descender hasta el inicio se puede volver a ascender mientras quede tiempo.

#### `SupersetConfig`

- Exactamente dos selecciones de ejercicio ordenadas.
- Número de supersets mayor que cero.
- Objetivo propio para cada variante.
- Descanso previsto después de la pareja, un minuto por defecto.
- Instrucciones opcionales.

No existe descanso planificado entre las dos variantes.

### 17.7 Sesiones de entrenamiento

#### `WorkoutSession`

Raíz de la realización real de un entrenamiento.

Datos principales:

- Referencia al entrenamiento de origen.
- Estado: `IN_PROGRESS`, `COMPLETED` o `CANCELLED`.
- Fase actual mientras está en curso: `READY`, `WORKING` o `RESTING`.
- Bloques congelados y variantes relativas ya resueltas.
- Posición actual.
- Marcas de inicio, finalización o cancelación.
- Motivo de cancelación y notas opcionales.
- Porcentaje final de cumplimiento.

Sólo puede existir una sesión `IN_PROGRESS`. Su planificación congelada no se edita.

#### `SessionBlockSnapshot`

Copia inmutable de lo necesario para ejecutar e interpretar históricamente un bloque:

- Orden, nombre y metodología.
- Configuración planificada.
- Variantes concretas resueltas.
- Nombre, nivel y objetivo mostrados en el momento de inicio.

#### `WorkUnit`

Unidad controlada por un único inicio y una única finalización:

- Tipo `NORMAL_SET` o `SUPERSET`.
- Estado `PENDING`, `ACTIVE` o `COMPLETED`.
- Posición dentro del bloque.
- Inicio y fin reales.
- Uno o dos `WorkUnitItem`.

Una serie normal contiene un elemento. Un superset contiene exactamente dos y sólo se completa la pareja entera.

#### `WorkUnitItem`

- Variante concreta y objetivo congelado.
- Resultado real opcional.
- No tiene botón, cronómetro ni estado independiente dentro de un superset.

#### `PyramidRun` y `PyramidStep`

Una pirámide es una unidad temporal completa con pasos generados durante la ejecución:

- `PyramidRun` conserva duración objetivo, inicio, fin y estado.
- Cada `PyramidStep` registra repeticiones objetivo, dirección `UP`/`DOWN`, inicio, fin y resultado opcional.
- El descanso de un paso se calcula según las repeticiones y el multiplicador configurado.
- La pirámide finaliza al agotarse su duración, no al alcanzar un número predeterminado de pasos.

Los pasos sirven para el historial, pero la pirámide completa cuenta como una unidad planificada para calcular progreso.

#### `RestPeriod`

- Unidad de trabajo anterior y siguiente, cuando exista.
- Duración planificada.
- Inicio automático al finalizar el trabajo.
- Momento objetivo del aviso sonoro.
- Final real cuando se inicia el siguiente trabajo.
- Duración real derivada.

Que la cuenta atrás llegue a cero no inicia el trabajo siguiente ni termina el descanso real. El usuario debe pulsar para continuar y el exceso queda registrado.

#### Máquina de estados de `WorkoutSession`

1. `startSession` valida el entrenamiento, resuelve niveles, crea la instantánea y consume el entrenamiento.
2. La sesión comienza `IN_PROGRESS/READY`.
3. `startWork` pasa a `WORKING` y fija la hora de inicio.
4. `finishWork` completa la unidad activa y solicita opcionalmente resultados reales.
5. Si corresponde descanso, pasa a `RESTING`; de lo contrario avanza a `READY` o finaliza.
6. `startNextWork` cierra el descanso real, aunque sea antes o después del objetivo, y pasa a `WORKING`.
7. Al completar el último trabajo, pasa a `COMPLETED`.
8. `cancelSession` puede ejecutarse desde cualquier fase no terminal y pasa a `CANCELLED`.
9. Los estados terminales no admiten cambios factuales; sólo se pueden editar notas.

Una recarga reconstruye la cuenta atrás y el cronómetro usando las marcas temporales persistidas.

#### Porcentaje completado

- Serie normal completada: una unidad.
- Pareja de superset completada: una unidad.
- Pirámide completada: una unidad.
- Pirámide interrumpida por cancelación: fracción `tiempo activo / duración objetivo`, limitada a 0-1.
- Una serie o superset activos al cancelar no cuentan hasta haberse completado.
- Porcentaje: suma de unidades completadas o fracciones dividida entre unidades planificadas.
- El porcentaje terminal se almacena como hecho histórico junto con los datos usados para calcularlo.

### 17.8 Historial e inmutabilidad

- Una sesión completada o cancelada conserva su instantánea, trabajo, descansos y tiempos.
- Una evaluación completada o cancelada conserva criterios, resultados y mediciones.
- Cambiar nombres, descripciones, niveles o medios del catálogo no altera los hechos históricos.
- Las notas pueden editarse sin modificar los hechos de ejecución.
- Los resúmenes y comparaciones son vistas derivadas, no nuevas fuentes de verdad.

Vistas principales:

- `CatalogVariantList`.
- `AssessmentHistory`.
- `CurrentCapabilityLevels`.
- `PendingWorkoutQueue`.
- `ActiveWorkoutSession`.
- `WorkoutSessionHistory`.

### 17.9 Acceso del propietario y API

#### Contraseña de interfaz

- Es configuración de infraestructura mediante variable de entorno.
- No existe entidad de usuario ni contraseña en la base de datos.
- Una autenticación correcta crea una sesión web revocable y con caducidad.

#### `ApiToken`

- Nombre descriptivo.
- Hash del secreto; nunca se conserva el token en claro.
- Permisos de lectura y, opcionalmente, escritura de entrenamientos.
- Fechas de creación, último uso y revocación.
- Un token revocado deja de ser válido inmediatamente.

Ningún permiso habilita mutaciones de evaluaciones ni control de sesiones activas.

### 17.10 Invariantes globales

- Exactamente cinco capacidades evaluables, cada una con niveles 1-5.
- Una sola evaluación en curso y una sola sesión de entrenamiento en curso.
- No puede iniciarse un entrenamiento vacío o con selecciones relativas sin resolver.
- Un bloque normal o pirámide contiene una selección; un superset contiene exactamente dos.
- Cantidades, duraciones, repeticiones y posiciones no pueden ser negativas.
- Los órdenes dentro de una colección son únicos.
- Una operación terminal no puede revertirse.
- Las fechas internas se almacenan en UTC.
- Todas las transiciones se validan en el servidor, aunque sólo sean invocables desde la UI.
- La API pública nunca puede modificar evaluaciones ni sesiones activas.

### 17.11 Decisiones confirmadas de esta fase

1. Se cargarán los criterios de evaluación para hombres.
2. Un entrenamiento permanece consumido si su sesión se cancela; para repetirlo se crea una copia desde el historial.
3. Una pirámide temporizada completa cuenta como una unidad y, si se cancela, aporta la fracción de tiempo realizada.

El modelo queda aprobado para diseñar la persistencia.

## 18. Fase 3 - Persistencia SQLite

### 18.1 Decisiones generales

- Un único fichero SQLite por instalación.
- Ruta local configurable; ruta de producción en Railway: `/app/data/training.sqlite`.
- Identificadores UUIDv7 almacenados como `TEXT`.
- Nombres de tablas y columnas en inglés y `snake_case`.
- Marcas temporales UTC como enteros Unix en milisegundos.
- Duraciones como enteros en milisegundos.
- Repeticiones y niveles como enteros.
- Booleanos como enteros `0/1` con restricción.
- Enumeraciones como `TEXT` con restricciones `CHECK`.
- Claves foráneas activadas en cada conexión.
- No se almacenan imágenes ni vídeos como BLOB.
- No hay tablas de usuarios, organizaciones o propietarios.
- Se evitarán columnas JSON para los hechos principales; las relaciones consultables serán relacionales.

Configuración prevista de SQLite:

- `foreign_keys = ON`.
- Modo WAL para el funcionamiento normal.
- `busy_timeout` para evitar fallos inmediatos ante escrituras breves concurrentes.
- Una única instancia de aplicación escritora.
- Checkpoints y copias consistentes mediante las herramientas de SQLite, nunca copiando a ciegas una base activa.

### 18.2 Resumen del esquema

| Área | Tablas |
|---|---|
| Catálogo | `exercise_variants`, `media_assets`, `capability_level_definitions`, `capability_level_requirements` |
| Evaluaciones | `assessments`, `assessment_capabilities`, `assessment_level_results`, `assessment_level_measurements` |
| Entrenamientos | `workouts`, `workout_blocks`, `workout_block_items`, `workout_block_item_targets` |
| Sesiones | `workout_sessions`, `session_blocks`, `session_block_items`, `session_block_item_targets`, `session_work_units`, `session_work_unit_items`, `session_work_unit_measurements`, `pyramid_runs`, `pyramid_steps`, `rest_periods` |
| Configuración y acceso | `app_settings`, `api_tokens`, `api_idempotency_keys` |
| Búsqueda y lectura | `exercise_variants_fts` y vistas derivadas |

### 18.3 Catálogo

#### `exercise_variants`

| Campo | Uso |
|---|---|
| `id` | UUIDv7, clave primaria. |
| `slug` | Identificador humano estable y único. |
| `name` | Nombre visible. |
| `exercise_type` | Uno de los seis tipos cerrados. |
| `difficulty_min`, `difficulty_max` | Rango 1-5 o ambos nulos. |
| `description` | Descripción completa. |
| `source_page_start`, `source_page_end` | Referencia opcional al libro. |
| `is_active` | Permite retirar una variante sin romper historial. |
| `created_at`, `updated_at` | Auditoría básica. |

Restricciones:

- `slug` único.
- Los límites de dificultad son ambos nulos o ambos presentes.
- Si existen: `1 <= difficulty_min <= difficulty_max <= 5`.
- Una variante referenciada no se elimina físicamente; se desactiva.

#### `media_assets`

| Campo | Uso |
|---|---|
| `id` | Clave primaria. |
| `exercise_variant_id` | Variante propietaria. |
| `position` | Orden en la galería. |
| `kind` | `IMAGE` o `VIDEO`. |
| `storage_kind` | `LOCAL`, `S3` o `EXTERNAL_URL`. |
| `storage_key` | Ruta relativa local o clave de objeto S3. |
| `external_url` | URL para vídeo externo. |
| `mime_type` | Tipo MIME opcional. |
| `alt_text` | Descripción accesible opcional. |
| `created_at`, `updated_at` | Auditoría. |

Restricciones:

- Posición única por variante.
- `LOCAL` y `S3` exigen `storage_key` y prohíben `external_url`.
- `EXTERNAL_URL` exige URL y prohíbe clave.
- Eliminación en cascada sólo durante carga o corrección de una variante todavía no usada; la aplicación normal desactiva en vez de borrar.

#### `capability_level_definitions`

| Campo | Uso |
|---|---|
| `id` | Clave primaria estable. |
| `capability` | Una de las cinco capacidades. |
| `level` | Nivel 1-5. |
| `exercise_variant_id` | Variante evaluada. |
| `instructions` | Instrucciones opcionales. |
| `created_at`, `updated_at` | Auditoría. |

Restricción única sobre `(capability, level)`. Habrá exactamente 25 filas activas, con criterios masculinos.

#### `capability_level_requirements`

Permite criterios simples o compuestos.

| Campo | Uso |
|---|---|
| `id` | Clave primaria. |
| `capability_level_definition_id` | Definición propietaria. |
| `position` | Orden del requisito. |
| `label` | Ejemplo: “brazos extendidos”. |
| `metric_kind` | `REPETITIONS` o `DURATION`. |
| `scope` | `TOTAL`, `PER_SIDE`, `PER_HAND` o `PER_LEG`. |
| `required_value` | Mínimo requerido; repeticiones o milisegundos. |

Posición única por definición y valores estrictamente positivos.

### 18.4 Evaluaciones

#### `assessments`

| Campo | Uso |
|---|---|
| `id` | Clave primaria. |
| `status` | `IN_PROGRESS`, `COMPLETED` o `CANCELLED`. |
| `started_at` | Inicio. |
| `completed_at`, `cancelled_at` | Una según el estado terminal. |
| `notes` | Notas editables. |
| `created_at`, `updated_at` | Auditoría. |

Un índice único parcial garantizará como máximo una evaluación `IN_PROGRESS`.

#### `assessment_capabilities`

| Campo | Uso |
|---|---|
| `id` | Clave primaria. |
| `assessment_id` | Evaluación propietaria. |
| `capability` | Capacidad. |
| `position` | Orden de presentación 1-5. |
| `status` | `NOT_STARTED`, `IN_PROGRESS` o `COMPLETED`. |
| `previous_maximum_level` | Referencia anterior opcional. |
| `starting_level` | Nivel inicial congelado. |
| `maximum_level` | Último nivel intentado al completar. |
| `started_at`, `completed_at` | Marcas opcionales. |

Restricciones únicas sobre `(assessment_id, capability)` y `(assessment_id, position)`. Niveles limitados a 1-5.

#### `assessment_level_results`

| Campo | Uso |
|---|---|
| `id` | Clave primaria. |
| `assessment_capability_id` | Capacidad evaluada. |
| `capability_level_definition_id` | Definición que originó el resultado. |
| `level` | Nivel presentado. |
| `exercise_variant_id` | Variante presentada. |
| `variant_name_snapshot` | Nombre mostrado entonces. |
| `outcome` | `PASSED` o `FAILED`. |
| `answered_at` | Momento de respuesta. |

Un nivel sólo puede aparecer una vez dentro de cada capacidad de una evaluación.

#### `assessment_level_measurements`

Guarda conjuntamente la copia del criterio y la medición real:

| Campo | Uso |
|---|---|
| `id` | Clave primaria. |
| `assessment_level_result_id` | Resultado propietario. |
| `position` | Orden del requisito. |
| `label`, `metric_kind`, `scope` | Semántica congelada. |
| `required_value` | Criterio vigente entonces. |
| `actual_value` | Resultado real; obligatorio en fallos y opcional en éxitos. |

La obligatoriedad del valor real en un fallo se valida en la misma transacción que registra el resultado.

#### Vista `current_capability_levels`

Vista SQL derivada de la evaluación `COMPLETED` más reciente. Devuelve una fila por capacidad y su `maximum_level`. Una evaluación cancelada o en curso no participa.

No habrá una tabla mutable de “niveles actuales”, evitando dos fuentes de verdad.

### 18.5 Entrenamientos pendientes

#### `workouts`

| Campo | Uso |
|---|---|
| `id` | Clave primaria. |
| `name` | Nombre. |
| `notes` | Notas opcionales. |
| `status` | `PENDING` o `CONSUMED`. |
| `queue_position` | Posición sólo mientras está pendiente. |
| `version` | Entero creciente para control de concurrencia optimista. |
| `created_at`, `updated_at`, `consumed_at` | Auditoría. |

Restricciones:

- Posición única entre entrenamientos pendientes mediante índice parcial.
- `queue_position` obligatoria en `PENDING` y nula en `CONSUMED`.
- Sólo los pendientes pueden eliminarse físicamente.

#### `workout_blocks`

La configuración de las tres metodologías vive en columnas explícitas; no se usa JSON ni una abstracción para metodologías desconocidas.

| Campo | Uso |
|---|---|
| `id`, `workout_id`, `position` | Identidad, propietario y orden. |
| `name`, `instructions` | Texto opcional. |
| `method` | `NORMAL_SETS`, `PYRAMID` o `SUPERSET`. |
| `unit_count` | Series normales o número de supersets; nulo en pirámide. |
| `between_units_rest_ms` | Descanso entre series o parejas. |
| `after_block_rest_ms` | Descanso antes del bloque siguiente. |
| `pyramid_duration_ms` | Duración total de la pirámide. |
| `pyramid_initial_reps` | Inicio, normalmente 1. |
| `pyramid_rest_ms_per_rep` | Multiplicador de descanso. |

Posición única por entrenamiento. Restricciones por método impiden configuraciones incompatibles o cantidades no positivas.

#### `workout_block_items`

| Campo | Uso |
|---|---|
| `id`, `workout_block_id`, `position` | Identidad, bloque y orden. |
| `selection_kind` | `EXPLICIT_VARIANT` o `CAPABILITY_RELATIVE`. |
| `exercise_variant_id` | Sólo para selección explícita. |
| `capability`, `level_offset` | Sólo para selección relativa; offset `-1`, `0` o `1`. |

La validación del agregado exige un elemento para series/pirámide y exactamente dos para superset.

#### `workout_block_item_targets`

| Campo | Uso |
|---|---|
| `id`, `workout_block_item_id`, `position` | Identidad, elemento y orden. |
| `label`, `metric_kind`, `scope` | Semántica del objetivo. |
| `minimum_value`, `maximum_value` | Valor fijo o rango; repeticiones o milisegundos. |

`minimum_value <= maximum_value`, ambos positivos. Una pirámide no necesita filas de objetivo porque las repeticiones se generan dinámicamente.

### 18.6 Sesiones e historial de entrenamiento

#### `workout_sessions`

| Campo | Uso |
|---|---|
| `id` | Clave primaria. |
| `source_workout_id` | Entrenamiento consumido. |
| `status` | `IN_PROGRESS`, `COMPLETED` o `CANCELLED`. |
| `phase` | `READY`, `WORKING` o `RESTING` mientras está en curso. |
| `current_session_block_id` | Cursor opcional. |
| `current_work_unit_id`, `current_pyramid_step_id`, `active_rest_period_id` | Cursores excluyentes según fase. |
| `started_at`, `completed_at`, `cancelled_at` | Ciclo de vida. |
| `cancellation_reason` | Opcional. |
| `notes` | Único texto histórico editable. |
| `completion_numerator`, `completion_denominator`, `completion_percentage` | Cálculo terminal congelado. |
| `created_at`, `updated_at` | Auditoría. |

Un índice único parcial garantiza una única sesión `IN_PROGRESS`.

#### `session_blocks`

Instantánea de cada bloque:

- `id`, `workout_session_id`, `source_workout_block_id`, `position`.
- Nombre, instrucciones y metodología congelados.
- Las mismas columnas de configuración material que `workout_blocks`.
- Número de unidades planificadas usado para el porcentaje.

Posición única por sesión. No se modifica después de crear la sesión.

#### `session_block_items`

- `id`, `session_block_id`, `position`.
- Variante concreta resuelta.
- Nombre, tipo, nivel y selección original congelados.
- El offset solicitado, si procedía de una selección relativa.

#### `session_block_item_targets`

Copia inmutable de los objetivos de cada elemento con la misma forma que `workout_block_item_targets`.

#### `session_work_units`

Series normales y parejas de superset pregeneradas al iniciar:

| Campo | Uso |
|---|---|
| `id`, `session_block_id`, `position` | Identidad, bloque y orden. |
| `kind` | `NORMAL_SET` o `SUPERSET`. |
| `status` | `PENDING`, `ACTIVE` o `COMPLETED`. |
| `started_at`, `ended_at` | Tiempo activo real. |

Un índice parcial impide más de una unidad `ACTIVE` en la instalación.

#### `session_work_unit_items`

- Relaciona una unidad con uno o dos `session_block_items`.
- Posición única dentro de la unidad.
- Series normales: exactamente una fila.
- Supersets: exactamente dos filas.

#### `session_work_unit_measurements`

Resultados reales opcionales de cada elemento:

- Elemento de unidad.
- Posición/etiqueta del objetivo al que responde.
- Tipo, ámbito y valor real.

No se exige una fila para completar la unidad.

#### `pyramid_runs`

Una fila por bloque de pirámide:

- Estado `PENDING`, `ACTIVE`, `COMPLETED` o `CANCELLED`.
- Duración objetivo congelada.
- Inicio, final y tiempo activo real.
- Dirección y siguiente número de repeticiones pueden persistirse como cursor recuperable.

Relación uno a uno con `session_blocks` de metodología pirámide.

#### `pyramid_steps`

- `id`, `pyramid_run_id`, `position`.
- Repeticiones objetivo.
- Dirección `UP` o `DOWN`.
- Inicio y final.
- Repeticiones reales opcionales.

Los pasos se crean durante la ejecución y no cambian el denominador del porcentaje.

#### `rest_periods`

| Campo | Uso |
|---|---|
| `id`, `workout_session_id`, `session_block_id`, `position` | Identidad y orden global. |
| `reason` | `BETWEEN_UNITS`, `BETWEEN_BLOCKS` o `PYRAMID_STEP`. |
| `after_work_unit_id`, `after_pyramid_step_id`, `after_pyramid_run_id` | Exactamente una procedencia. |
| `planned_duration_ms` | Descanso previsto. |
| `started_at`, `target_end_at`, `ended_at` | Tiempos. |
| `actual_duration_ms` | Resultado derivado al terminar. |

Un índice parcial impide más de un descanso sin finalizar. Llegar a `target_end_at` no cierra la fila; se cierra al comenzar el siguiente trabajo.

### 18.7 Configuración y acceso

#### `app_settings`

Tabla singleton con fila fija:

- Zona horaria IANA.
- Sonido activado.
- Descanso por defecto.
- Versión creciente de la cola de entrenamientos, actualizada en toda operación que cambie sus miembros u orden.
- Fechas de creación y modificación.

No contiene contraseña, identidad ni configuración multiusuario.

#### `api_tokens`

| Campo | Uso |
|---|---|
| `id`, `name` | Identidad y nombre visible. |
| `token_prefix` | Fragmento identificable sin revelar el secreto. |
| `secret_hash` | Hash del token. |
| `can_read` | Permiso de lectura. |
| `can_write_workouts` | Permiso para gestionar entrenamientos pendientes. |
| `created_at`, `last_used_at`, `revoked_at` | Ciclo de vida. |

El token completo sólo se muestra al crearlo. La contraseña web y el secreto de firma de sesión proceden de variables de entorno.

#### `api_idempotency_keys`

Registro operativo para poder repetir con seguridad las mutaciones `POST` de la API:

- Token propietario y clave de idempotencia.
- Hash del método, ruta y cuerpo de la petición.
- Código HTTP y respuesta serializada que deben reproducirse.
- Fechas de creación y caducidad.

La pareja `(api_token_id, idempotency_key)` será única. Estos datos podrán purgarse al expirar; no son hechos de dominio.

### 18.8 Relaciones y borrado

- `exercise_variants`: no se borran si han sido publicadas; se desactivan.
- `media_assets`: dependen de la variante.
- Definiciones de capacidad: no se borran si existen resultados; los resultados guardan además una instantánea.
- `assessments` y su contenido: no se eliminan desde la aplicación ni la API.
- `workouts` pendientes: pueden borrarse en cascada con bloques, elementos y objetivos.
- `workouts` consumidos: no se borran.
- `workout_sessions` y su contenido: no se eliminan desde la aplicación ni la API.
- Tokens: se revocan; no es necesario borrarlos para invalidarlos.
- Las claves foráneas históricas utilizan `RESTRICT`; las composiciones editables pendientes pueden utilizar `CASCADE`.

### 18.9 Índices y búsqueda

Índices principales:

- Variante por `slug` único.
- Variantes por `(exercise_type, name, id)`.
- Medios por `(exercise_variant_id, position)` único.
- Definiciones por `(capability, level)` único.
- Evaluaciones por `(status, started_at DESC, id)`.
- Capacidades por `(assessment_id, position)`.
- Resultados por `(assessment_capability_id, level)` único.
- Entrenamientos pendientes por `(status, queue_position)`.
- Bloques y elementos por sus padres y posición única.
- Sesiones por `(status, started_at DESC, id)`.
- Unidades, pasos y descansos por bloque/sesión y posición.
- Tokens activos por `token_prefix`.

#### Búsqueda textual

Se usará FTS5 mediante `exercise_variants_fts`, indexando nombre y descripción. La sincronización con `exercise_variants` se hará en migraciones y mediante triggers o escritura coordinada desde el repositorio.

La lista se ordenará de forma estable, inicialmente por nombre e identificador. El servidor devolverá cursores opacos; la UI transformará los lotes en scroll infinito sin mostrar páginas.

Con sólo 71 variantes el rendimiento no es un problema, pero FTS5 evita implementar búsquedas con comodines y deja una semántica clara.

### 18.10 Operaciones transaccionales

| Operación | Cambios atómicos |
|---|---|
| Reordenar pendientes | Todas las posiciones afectadas. |
| Crear evaluación | Evaluación y cinco capacidades con niveles iniciales. |
| Registrar resultado | Resultado, mediciones, avance/cierre de capacidad y cursor. |
| Completar evaluación | Cierre de la quinta capacidad y de la evaluación. |
| Iniciar sesión | Validación, resolución de niveles, instantánea completa, pregeneración de unidades y consumo del entrenamiento. |
| Iniciar/finalizar trabajo | Estado de unidad/pirámide, cursores y marcas temporales. |
| Iniciar/finalizar descanso | Descanso y fase/cursor de sesión. |
| Completar/cancelar sesión | Estados terminales y cálculo congelado de cumplimiento. |
| Duplicar entrenamiento | Entrenamiento, bloques, elementos, objetivos y nueva posición de cola. |

Los sonidos y cronómetros visuales no escriben por sí solos; sólo las transiciones del usuario y los hechos terminales generan escrituras.

### 18.11 Migraciones

- Migraciones lineales, versionadas y comprometidas con el proyecto.
- Aplicación en una transacción cuando SQLite lo permita.
- Ejecución por una sola instancia antes de aceptar tráfico.
- Ningún `push` automático de esquema en producción.
- Una migración destructiva requiere copia consistente previa y procedimiento de rollback.
- La aplicación no arrancará con una versión de esquema incompatible.
- Los cambios de catálogo se separan de las migraciones estructurales siempre que sea posible.

La herramienta concreta de migraciones se elegirá junto con la capa de acceso a datos en la fase de arquitectura.

### 18.12 Datos iniciales

La carga inicial será idempotente y versionada. Usará identificadores o slugs estables e incluirá:

- 71 variantes.
- 145 imágenes.
- 19 URLs de vídeo.
- Cinco tipos principales más cuerpo completo.
- 25 definiciones de capacidad, niveles 1-5.
- Criterios masculinos del libro, incluidos los compuestos.
- La fila singleton de ajustes.

La semilla no sobrescribirá entrenamientos, evaluaciones, sesiones, notas ni tokens. Una corrección posterior del catálogo se realizará mediante una nueva versión de datos explícita.

Las imágenes locales conservarán claves relativas. En producción se migrarán a S3 y sólo cambiarán `storage_kind` y `storage_key`; las referencias de variantes permanecerán estables.

### 18.13 Backup y restauración

#### Backup

- Crear una copia consistente con la API de backup de SQLite o `VACUUM INTO`.
- Guardarla primero con nombre temporal en el volumen.
- Validar integridad antes de considerarla recuperable.
- Descargarla mediante Railway CLI/SCP o copiarla a almacenamiento S3.
- No respaldar únicamente el fichero principal mientras existan escrituras WAL sin consolidar.
- Crear siempre una copia antes de una migración destructiva.
- Crear automáticamente una copia diaria desde el primer despliegue.
- Copiar el backup automático fuera del volumen de Railway, inicialmente a S3.
- Conservar inicialmente siete copias diarias y cuatro semanales.

#### Restauración

- Subir la copia validada con nombre temporal.
- Detener la aplicación.
- Conservar la base anterior como rollback.
- Sustituir base y limpiar correctamente el estado WAL/SHM asociado.
- Reiniciar, comprobar integridad y verificar la versión de migraciones.
- Restaurar la anterior si falla cualquier comprobación.

No habrá interfaz web de backup o restauración en el MVP. El procedimiento será un runbook operativo.

### 18.14 Decisiones confirmadas de esta fase

1. Se usarán UUIDv7 almacenados como texto.
2. La base de producción estará en `/app/data/training.sqlite`.
3. Las evaluaciones y sesiones históricas no podrán eliminarse desde la aplicación ni la API.
4. Habrá backups automáticos periódicos desde el primer despliegue, además de copias manuales y previas a migraciones.

La persistencia queda aprobada para definir el contrato de la API.

## 19. Fase 4 - Contrato de API

### 19.1 Límite de la API pública

La API es una interfaz para agentes e integraciones, no el backend completo de la interfaz web. Los casos de uso exclusivos de la UI permanecerán como operaciones internas del servidor y no adquirirán una ruta pública accidentalmente.

| Área | Acceso público |
|---|---|
| Catálogo y medios | Lectura. |
| Definiciones de capacidades | Lectura. |
| Evaluaciones y niveles actuales | Lectura. |
| Entrenamientos pendientes | Lectura, creación, sustitución, duplicación, borrado y reordenación. |
| Validación de un entrenamiento | Lectura; informa si podría iniciarse, pero no lo inicia. |
| Sesiones completadas o canceladas | Lectura. |
| Evaluación en curso | Puede consultarse como evaluación, pero no avanzar ni modificarse. |
| Sesión de entrenamiento en curso | Completamente invisible para la API pública. |
| Tokens, ajustes, backups y archivos internos | Sin API pública. |

No existirán rutas públicas para iniciar, reanudar, controlar, completar o cancelar una sesión; registrar trabajo, descansos o mediciones; ni para crear o modificar evaluaciones.

### 19.2 Convenciones de representación

- Prefijo estable `/api/v1`.
- JSON UTF-8 para peticiones y respuestas, salvo el contenido binario de medios.
- Rutas y recursos en inglés, en minúsculas y con guiones cuando tengan varias palabras.
- Propiedades JSON en inglés y, como propuesta, en `camelCase` para encajar con TypeScript.
- Identificadores UUIDv7 representados como cadenas opacas. El cliente no deduce información ni orden a partir de ellos.
- Fechas y horas en respuestas como RFC 3339 UTC, por ejemplo con sufijo `Z`; los milisegundos Unix internos no salen al contrato.
- Duraciones como enteros en milisegundos y con sufijo `Ms` en el nombre.
- Enumeraciones como cadenas estables en mayúsculas, por ejemplo `NORMAL_SETS`.
- Los textos del catálogo permanecen en español; no habrá negociación de idioma en el MVP.
- En respuestas, un dato conocido pero ausente se representa con `null`; un campo que no pertenezca a esa representación se omite.
- Las respuestas correctas con cuerpo usan un sobre `{ data, meta? }`. Un borrado correcto responde sin cuerpo.

Los campos desconocidos enviados por un cliente producirán error de validación. Esto ayuda a detectar erratas de agentes en lugar de ignorarlas silenciosamente. Los clientes, en cambio, deberán tolerar propiedades nuevas en las respuestas.

### 19.3 Autenticación y permisos

Toda ruta pública de datos requiere:

`Authorization: Bearer <token>`

Los tokens sólo se crean, nombran y revocan desde la interfaz autenticada. El token completo se muestra una vez; la base conserva únicamente su hash y un prefijo identificable.

Permisos:

| Permiso | Autoriza |
|---|---|
| `read` | Todas las lecturas incluidas en la API. |
| `workouts:write` | Mutaciones sobre entrenamientos pendientes y la cola. |

Un token puede tener uno o ambos permisos. El login mediante contraseña y cookie no sustituye automáticamente al Bearer token en las rutas públicas; la UI compartirá casos de uso internos, no dependerá de fingir ser un cliente externo.

- Token ausente o inválido: `401` y cabecera `WWW-Authenticate`.
- Token válido sin permiso suficiente: `403`.
- Token revocado: se trata como inválido desde la siguiente petición.
- CORS estará desactivado por defecto. El MVP no necesita llamadas desde otros orígenes web; los agentes consumirán la API servidor a servidor.

### 19.4 Colecciones, cursores y filtros

Las colecciones que crecen con el historial usan cursores opacos:

- `limit`: 50 por defecto, 100 como máximo.
- `cursor`: valor devuelto por la página anterior.
- Respuesta `meta.page`: `nextCursor` y `hasMore`.
- No se devuelve un total salvo que un caso de uso lo necesite realmente.
- El cursor queda ligado a filtros y orden. Reutilizarlo con otros filtros produce `400 INVALID_CURSOR`.
- Siempre existe un desempate por `id` para que el orden sea estable.

La cola de pendientes no se pagina: se devuelve completa porque el orden global forma parte del recurso y se necesita entero para reordenarlo. La ausencia de paginación visible en la UI se conserva; la interfaz convierte los cursores del resto de colecciones en scroll infinito.

Parámetros comunes de fecha:

- `startedFrom` y `startedTo`, inclusivos y expresados como RFC 3339.
- Si ambos existen, el inicio no puede ser posterior al final.

No habrá orden arbitrario en el MVP. Cada colección declara uno estable:

- Variantes: nombre e identificador ascendentes.
- Evaluaciones: fecha de inicio e identificador descendentes.
- Historial de sesiones: fecha de inicio e identificador descendentes.
- Pendientes: posición de cola ascendente.

### 19.5 Catálogo

#### Rutas

| Método y ruta | Resultado |
|---|---|
| `GET /api/v1/exercise-variants` | Lista filtrada de variantes activas. |
| `GET /api/v1/exercise-variants/{variantId}` | Detalle y galería completa. |
| `GET /api/v1/exercise-catalog-options` | Tipos, etiquetas y rango de dificultad disponibles. |
| `GET /api/v1/capability-level-definitions` | Las 25 definiciones y criterios masculinos de evaluación. |
| `GET /api/v1/media-assets/{mediaId}/content` | Contenido local o redirección controlada al almacenamiento. |

Filtros de variantes:

- `q`: búsqueda de texto en nombre y descripción.
- `exerciseType`: repetible para seleccionar varios tipos.
- `difficultyMin` y `difficultyMax`: límites 1-5.
- `limit` y `cursor`.

El filtro de dificultad conserva la regla acordada: hay coincidencia si el rango de la variante se solapa con el solicitado. Las variantes sin dificultad sólo aparecen cuando no hay filtro de dificultad.

La representación resumida de una variante contiene identificador, slug, nombre, tipo, dificultad mínima y máxima, medio de portada y conteo de medios. El detalle añade descripción, páginas de origen y la colección ordenada de medios.

Cada medio informa `id`, `kind`, `altText` y una URL producida por el servidor. El cliente no construye rutas a partir de `storageKey` ni conoce si el archivo está en local o S3. Una URL temporal puede incluir `expiresAt`; los clientes no deben persistirla.

### 19.6 Evaluaciones y niveles actuales

| Método y ruta | Resultado |
|---|---|
| `GET /api/v1/assessments` | Historial resumido, incluidas evaluaciones en curso, completadas y canceladas. |
| `GET /api/v1/assessments/{assessmentId}` | Detalle de capacidades, niveles intentados, criterios congelados y mediciones. |
| `GET /api/v1/current-capability-levels` | Nivel actual de cada capacidad derivado de la última evaluación completada. |

Filtros de evaluaciones:

- `status`, repetible: `IN_PROGRESS`, `COMPLETED` o `CANCELLED`.
- `startedFrom`, `startedTo`, `limit` y `cursor`.

El resumen de evaluación incluye estado, fechas, duración, notas y una fila por capacidad. El detalle conserva para cada nivel la variante mostrada, resultado, valores requeridos y valores reales.

`current-capability-levels` devuelve siempre las cinco capacidades. Cuando todavía no existe una evaluación completada, su nivel es `null` y se indica que no hay referencia disponible. Las evaluaciones canceladas o en curso nunca alteran esta respuesta.

Cualquier método de escritura sobre estas rutas queda fuera del contrato. No se añadirá una acción aparentemente inocua como `POST /assessments/{id}/results`.

### 19.7 Entrenamientos pendientes

#### Rutas

| Método y ruta | Resultado |
|---|---|
| `GET /api/v1/workout-queue` | Cola completa de entrenamientos pendientes. |
| `POST /api/v1/workouts` | Crea un pendiente al final de la cola. |
| `GET /api/v1/workouts/{workoutId}` | Obtiene el agregado editable completo. |
| `PUT /api/v1/workouts/{workoutId}` | Sustituye nombre, notas y estructura completa. |
| `DELETE /api/v1/workouts/{workoutId}` | Elimina un pendiente y compacta la cola. |
| `POST /api/v1/workouts/{workoutId}/duplicate` | Crea una copia inmediatamente después del original. |
| `GET /api/v1/workouts/{workoutId}/validation` | Devuelve si podría iniciarse y los conflictos encontrados. |
| `PUT /api/v1/workout-queue` | Reemplaza atómicamente el orden de toda la cola. |

`GET /workout-queue` devuelve elementos resumidos y la versión de la cola. El detalle de cada entrenamiento incluye:

- `id`, `version`, nombre, notas y fechas.
- Resumen calculado de bloques, métodos y duración estimada.
- Bloques en orden, sin propiedad `position` redundante.
- Método y configuración concreta del bloque.
- Uno o dos elementos según la metodología.
- Selección explícita o selección relativa a una capacidad.
- Objetivos ordenados con métrica, ámbito, mínimo y máximo.

Crear y sustituir usan la misma representación de entrada del agregado, sin campos calculados. Se admiten borradores incompletos siempre que cada dato presente sea válido; el endpoint de validación explica qué falta para poder iniciarlos.

No habrá rutas CRUD para bloques, elementos u objetivos. `PUT` reemplaza la composición anidada en una sola transacción. El orden de los arrays es el orden de ejecución y los identificadores internos anidados pueden regenerarse porque no son recursos públicos independientes.

Reglas de cola:

- Crear añade al final.
- Duplicar inserta inmediatamente después del original y añade “copia” al nombre.
- El cuerpo de `PUT /workout-queue` contiene exactamente una vez todos los identificadores pendientes actuales.
- Omitir, repetir o incluir un identificador que ya no está pendiente produce conflicto y no modifica nada.
- Un entrenamiento consumido es invisible en estas rutas. No se expone indirectamente si tiene una sesión activa.

La validación es de sólo lectura. Puede informar, entre otros, de bloques incompletos, número incorrecto de elementos, objetivos inválidos o ausencia de nivel actual para resolver una selección relativa. Un resultado válido no reserva ni inicia nada y puede quedar obsoleto después.

### 19.8 Historial de sesiones

| Método y ruta | Resultado |
|---|---|
| `GET /api/v1/workout-sessions` | Lista únicamente sesiones `COMPLETED` o `CANCELLED`. |
| `GET /api/v1/workout-sessions/{sessionId}` | Instantánea completa de una sesión terminal. |

Filtros:

- `status`, repetible pero limitado a `COMPLETED` y `CANCELLED`.
- `exerciseType`, repetible.
- `startedFrom`, `startedTo`, `limit` y `cursor`.

La lista contiene nombre del entrenamiento, estado, fechas, duración total, tiempo activo, descanso real y porcentaje completado. El detalle devuelve las instantáneas de bloques y variantes, unidades normales o supersets, pasos de pirámide, objetivos, mediciones reales, descansos y motivo de cancelación.

El detalle agrupa estos hechos en su orden natural; no se crearán endpoints separados para cada serie o descanso. Una sesión activa responde como recurso inexistente incluso si el cliente conoce su identificador. El historial es estrictamente de sólo lectura, incluidas sus notas.

### 19.9 Códigos HTTP

| Operación | Respuesta principal |
|---|---|
| Lectura correcta | `200 OK`. |
| Creación o duplicación | `201 Created` con `Location`. |
| Sustitución o reordenación | `200 OK` con el recurso actualizado. |
| Borrado | `204 No Content`. |
| JSON o parámetros mal formados | `400 Bad Request`. |
| Autenticación ausente o inválida | `401 Unauthorized`. |
| Permiso insuficiente | `403 Forbidden`. |
| Recurso no visible o inexistente | `404 Not Found`. |
| Clave idempotente reutilizada con otra petición o conflicto de cola | `409 Conflict`. |
| Precondición de versión fallida | `412 Precondition Failed`. |
| Falta una precondición obligatoria | `428 Precondition Required`. |
| Datos bien formados que incumplen validación o reglas de dominio | `422 Unprocessable Content`. |
| Exceso de peticiones, si se aplica protección operativa | `429 Too Many Requests`. |

### 19.10 Errores

Los errores usan `application/problem+json`, siguiendo Problem Details, con:

- `type`, `title`, `status`, `detail` e `instance`.
- `code`: identificador estable y legible por máquinas, por ejemplo `WORKOUT_NOT_STARTABLE`.
- `requestId`: correlación con logs.
- `errors`: lista opcional de errores con `path`, `code` y `message`.

Los mensajes pueden estar en español; la automatización debe decidir mediante `status`, `code` y `path`, nunca analizando el texto. No se devuelven trazas, SQL, rutas del servidor ni secretos.

### 19.11 Concurrencia e idempotencia

Cada entrenamiento pendiente devuelve `version` y una cabecera `ETag`. La cola completa tiene su propia versión y ETag.

- `PUT` y `DELETE` de un entrenamiento exigen `If-Match` con la versión leída.
- Reordenar la cola exige `If-Match` de la cola.
- Una versión antigua responde `412` sin cambios.
- La UI y la API incrementan las mismas versiones, evitando que un agente sobrescriba silenciosamente una edición realizada desde el móvil.

`POST /workouts` y `POST /workouts/{id}/duplicate` exigen `Idempotency-Key`:

- La clave se interpreta dentro del token que la utilizó.
- Repetir exactamente la petición durante 24 horas reproduce estado, cuerpo y cabeceras relevantes de la primera respuesta.
- Reutilizar la misma clave con otro método, ruta o cuerpo devuelve `409 IDEMPOTENCY_KEY_REUSED`.
- `PUT` ya es idempotente y no necesita esa cabecera.

### 19.12 Especificación OpenAPI

Se publicará una especificación OpenAPI 3.1 en `GET /api/v1/openapi.json` y una vista humana en `/api/docs`.

- Ambas requieren una sesión web válida o un Bearer token; el contrato no necesita estar expuesto anónimamente.
- Incluirán esquemas, enums, filtros, ejemplos, códigos de error y requisitos de idempotencia/concurrencia.
- El esquema de seguridad declarará Bearer token y los permisos aplicables a cada operación.
- La implementación y OpenAPI compartirán las mismas definiciones de validación para impedir divergencias.
- Habrá una comprobación automatizada de que el documento es válido y que las rutas públicas coinciden con lo documentado.

### 19.13 Límites y compatibilidad

- Cuerpo máximo inicial de 1 MiB; no se suben medios mediante esta API.
- Los límites de texto y cardinalidad se declararán en OpenAPI y se validarán antes de abrir una transacción.
- No habrá cuotas por usuario ni diseño de rate limiting multiusuario. Se podrá aplicar una protección global sencilla a nivel operativo.
- Añadir campos opcionales de respuesta o nuevos códigos de error no requiere una nueva versión; los clientes deben tolerarlos.
- Añadir valores a una enumeración cerrada puede ser incompatible y se evaluará como cambio de versión.
- Eliminar o reinterpretar campos, cambiar tipos o romper semántica exige `/api/v2`.
- Los campos obsoletos se marcarán en OpenAPI antes de retirarlos en una versión mayor.

### 19.14 Decisiones confirmadas de esta fase

1. Las propiedades JSON usarán `camelCase`; SQLite conservará `snake_case`.
2. La edición pública de un entrenamiento será un `PUT` del agregado completo, sin CRUD individual de bloques.
3. ETag e `If-Match` serán obligatorios para las mutaciones sujetas a concurrencia.
4. OpenAPI y su visor exigirán autenticación.
5. El MVP no tendrá un endpoint calculado de progreso. Los agentes usarán evaluaciones, niveles actuales e historial estructurado; se añadirá uno cuando existan métricas concretas que lo justifiquen.

El contrato queda aprobado para seleccionar la arquitectura y las herramientas de implementación.

## 20. Fase 5 - Arquitectura prevista

### 20.1 Forma de la aplicación

Se construirá un **monolito modular full-stack**:

- Una aplicación TanStack Start contiene interfaz, operaciones internas y API pública.
- Un único proceso Node atiende SSR, recursos estáticos, server functions y server routes.
- Una sola instancia y una sola conexión escritora a un fichero SQLite.
- No habrá microservicios, servidor REST separado, bus de eventos ni caché distribuida.
- La lógica de dominio y los casos de uso no dependerán de React, TanStack, HTTP, Drizzle ni Railway.
- La UI y la API son dos adaptadores de entrada distintos sobre los mismos casos de uso.

Esta forma mantiene una única implementación de las reglas sin diseñar infraestructura para una carga que nunca existirá.

### 20.2 Plataforma y dependencias principales

| Responsabilidad | Elección propuesta | Motivo |
|---|---|---|
| Runtime | Node.js 24 LTS | Versión LTS vigente y compatible con despliegue Node. |
| Gestor de paquetes | `pnpm`, versión fijada en el proyecto | Instalaciones reproducibles y lockfile estricto. |
| Aplicación web | TanStack Start, React, TypeScript estricto y Vite | SSR, routing, server functions y server routes en un proyecto. |
| Servidor de producción | Nitro sobre Node | Forma oficial actual de ejecutar TanStack Start con Vite en Railway. |
| Estado remoto de UI | TanStack Query | Caché, mutaciones e infinite queries para las listas con cursores. |
| Validación | Zod 4 | Esquemas compartidos por formularios, server functions, API y configuración. |
| OpenAPI | `@asteasolutions/zod-to-openapi` | Generación 3.1 desde los mismos esquemas Zod. |
| Acceso a datos | Drizzle ORM y Drizzle Kit | Esquema TypeScript, consultas tipadas y migraciones SQL revisables. |
| Driver SQLite | `better-sqlite3` | Driver maduro y síncrono apropiado para una única instancia y transacciones cortas. |
| Estilos | Tailwind CSS | Diseño mobile-first sin introducir un runtime de estilos. |
| Componentes | shadcn/ui con primitivas accesibles | Modales, sheets, menús y formularios viven en el repositorio y se pueden adaptar. |
| Objetos S3 | AWS SDK for JavaScript v3 | Medios privados, URLs firmadas y backups portables. |
| Logs | Pino | Logs estructurados con `requestId`, nivel y contexto. |
| Pruebas | Vitest, Testing Library y Playwright | Dominio, componentes, integración real con SQLite y recorridos móviles. |

No se usará por ahora `node:sqlite`: aunque Drizzle ya lo soporta, en Node 24 todavía figura como *release candidate*. Se podrá reevaluar cuando sea estable y aporte una ventaja concreta sobre `better-sqlite3`.

Las versiones exactas se fijarán al generar el proyecto y quedarán en el lockfile. No se usarán rangos abiertos en producción ni dependencias cargadas desde CDN.

### 20.3 Flujo de una operación

Desde la interfaz:

1. Una ruta o componente invoca una server function autenticada.
2. La server function valida la entrada y llama a un caso de uso.
3. El caso de uso aplica reglas del dominio y abre la transacción necesaria mediante un puerto de repositorio.
4. La infraestructura Drizzle persiste y devuelve datos de aplicación.
5. La server function devuelve un DTO pensado para la UI e invalida las consultas afectadas.

Desde la API pública:

1. Una server route aplica identificación de petición, Bearer token, permiso y límites.
2. Valida parámetros, cabeceras y cuerpo con los esquemas del contrato.
3. Invoca el mismo caso de uso que la UI.
4. Un presenter HTTP transforma el resultado en `{ data, meta }` o Problem Details.

Los handlers no contienen SQL ni reglas de negocio. Los repositorios tampoco deciden transiciones de estado: sólo cargan y guardan los cambios ordenados por el caso de uso.

### 20.4 Organización del proyecto

Estructura prevista, ajustable al scaffold real de TanStack Start:

| Ruta | Contenido |
|---|---|
| `src/routes/` | Rutas de pantalla, server routes públicas, login, medios y healthcheck. |
| `src/domain/` | Entidades, valores, invariantes, máquinas de estado y servicios puros. |
| `src/application/` | Casos de uso, DTO internos y puertos de repositorio, almacenamiento, reloj e identificadores. |
| `src/infrastructure/db/` | Esquema Drizzle, conexión, repositorios y unidad de trabajo SQLite. |
| `src/infrastructure/storage/` | Adaptadores local y S3. |
| `src/infrastructure/auth/` | Sesión web, tokens API y comprobación de permisos. |
| `src/server/` | Composición de dependencias, middleware, jobs, OpenAPI y presenters HTTP. |
| `src/features/` | Pantallas, hooks y componentes organizados por catálogo, evaluaciones, entrenamientos e historial. |
| `src/components/` | Componentes visuales compartidos y componentes shadcn adaptados. |
| `src/contracts/` | Esquemas Zod públicos, errores y registro OpenAPI. |
| `src/styles/` | Tema, tokens y estilos globales. |
| `drizzle/` | Migraciones SQL versionadas y metadatos de Drizzle Kit. |
| `seed/` | Datos normalizados del catálogo y manifiesto de medios. |
| `scripts/` | Importación, validación del seed, backup, restauración y operaciones locales. |
| `tests/` | Utilidades, integración y pruebas end-to-end. |
| `docs/runbooks/` | Despliegue, backup, restauración y rotación de secretos. |

Se favorecerán módulos y funciones con nombres de dominio frente a capas genéricas como `helpers` o `utils`. No se crearán interfaces por cada clase: sólo puertos que permitan separar una dependencia real.

### 20.5 Datos y transacciones

- Drizzle define tablas, columnas e índices ordinarios.
- FTS5, vistas, triggers y restricciones que Drizzle no exprese bien se escribirán como SQL explícito dentro de migraciones.
- Drizzle Kit generará migraciones iniciales, pero todo SQL se revisará y versionará antes de ejecutarse.
- No se utilizará `drizzle-kit push` contra producción.
- La aplicación abre una única conexión `better-sqlite3` reutilizada por proceso.
- En cada apertura se activan claves foráneas, WAL y `busy_timeout`.
- Las transacciones pertenecen al nivel de caso de uso y nunca atraviesan una espera del usuario, llamada S3 o respuesta HTTP.
- Las operaciones síncronas del driver serán pequeñas; no se harán informes pesados ni trabajo de red mientras SQLite esté bloqueada.
- Las pruebas de repositorio usarán un fichero SQLite temporal real con todas las migraciones, no una imitación en memoria de otro motor.

Los adaptadores transforman filas `snake_case` en objetos TypeScript `camelCase`. Las filas de la base no salen directamente ni a la UI ni a la API.

### 20.6 Carga de datos en la UI

- Los loaders de ruta preparan el estado inicial necesario para SSR.
- TanStack Query gestiona refresco, mutaciones e infinite scroll después de hidratarse.
- Texto y filtros del catálogo viven en la URL; el cursor cargado no forma parte de la URL.
- Un `IntersectionObserver` solicita el siguiente lote, con botón de respaldo accesible si falla o no está disponible.
- Las mutaciones de entrenamientos actualizan o invalidan únicamente la cola y el detalle afectados.
- No se añadirá Redux, Zustand ni otro almacén global en el MVP.
- El estado efímero de modales y formularios permanece local; los hechos recuperables se persisten inmediatamente en el servidor.

La UI no consumirá la API pública con un token interno. Utilizará server functions protegidas por sesión, de forma que la API pueda seguir siendo más limitada sin duplicar el dominio.

### 20.7 Autenticación de la interfaz

- `APP_PASSWORD` contiene la contraseña única definida por el propietario.
- `SESSION_SECRET`, independiente y de alta entropía, firma o cifra la cookie de sesión.
- No habrá tabla de usuarios, email, recuperación ni registro.
- La comparación de contraseña será constante y nunca se registrará el valor recibido.
- Cambiar la contraseña o el secreto invalidará las sesiones existentes.
- Cookie `HttpOnly`, `Secure` en producción y `SameSite=Lax`.
- Las mutaciones autenticadas por cookie validarán el `Origin` completo para prevenir CSRF.
- El login tendrá limitación sencilla de intentos y una respuesta indistinguible para cualquier fallo.
- Toda server function que lea o modifique datos privados aplicará middleware de sesión; ocultar una ruta en React no es una medida de seguridad.

Los Bearer tokens de la API utilizan otro middleware y nunca se guardan en cookies o almacenamiento del navegador. Sus secretos aleatorios se hashean con SHA-256, adecuado porque no son contraseñas elegidas por una persona.

### 20.8 Medios y almacenamiento

Se define un puerto `MediaStorage` con dos adaptadores:

- **Local:** lee los ficheros actuales desde una ruta configurada, inicialmente `Desencadenado-Entrenos con peso corporal/files`.
- **S3:** lee objetos de un bucket privado y genera URLs firmadas de corta duración cuando corresponda.

La base sólo conserva claves relativas. El dominio desconoce rutas físicas, buckets y URLs firmadas.

- La UI local recibe medios mediante una ruta autenticada por cookie.
- La API los sirve mediante su ruta Bearer o devuelve una URL firmada.
- Los vídeos externos permanecen como URLs externas y no se copian a S3.
- Las respuestas incluyen tipo MIME, `altText` y política de caché apropiada.
- No habrá subida o edición de medios en el MVP.
- Un script operativo futuro copiará los 145 recursos a S3 y actualizará únicamente `storage_kind` y `storage_key`.

El código usará el cliente S3 modular de AWS SDK v3 y permitirá configurar un endpoint S3-compatible sin cambiar el dominio.

### 20.9 Cronómetros, sonido y recuperación

- El servidor es la autoridad de las transiciones y sus marcas temporales.
- El cliente muestra cronómetros derivados de `startedAt` y `targetEndAt`; no acumula segundos mediante estado local.
- Al volver a primer plano o recuperar red, recalcula la pantalla desde el tiempo actual y el estado persistido.
- El aviso se programa en el navegador y se vuelve a evaluar al cambiar la visibilidad de la página.
- Web Audio se desbloquea mediante una interacción explícita antes del primer descanso.
- Wake Lock se solicita durante la sesión cuando exista y se recupera al volver a primer plano.
- El fallo de audio o Wake Lock no cambia el estado de la sesión ni impide entrenar.
- Una única mutación puede estar en vuelo para el control principal; el botón queda bloqueado hasta recibir la transición confirmada.

No habrá proceso servidor contando segundos ni WebSocket. Los tiempos se reconstruyen a partir de marcas persistidas, por lo que una recarga o suspensión del móvil no pierde el estado.

### 20.10 Configuración

Variables principales:

| Variable | Uso |
|---|---|
| `APP_PASSWORD` | Contraseña de la interfaz. |
| `SESSION_SECRET` | Secreto de sesión, mínimo 32 bytes de entropía. |
| `APP_ORIGIN` | Origen canónico para cookies y comprobación CSRF. |
| `DATABASE_PATH` | `./data/training.sqlite` en local y `/app/data/training.sqlite` en Railway. |
| `MEDIA_STORAGE` | `local` o `s3`. |
| `LOCAL_MEDIA_PATH` | Carpeta local de imágenes durante desarrollo. |
| `S3_BUCKET`, `S3_REGION` | Destino de medios y backups. |
| `S3_ENDPOINT` | Opcional para almacenamiento S3-compatible. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Credenciales sólo de servidor. |
| `LOG_LEVEL` | Nivel de logs. |
| `PORT` | Puerto inyectado por Railway. |

Zod valida la configuración completa antes de abrir la base. La aplicación no arranca con secretos débiles, origen inválido, almacenamiento incompleto o ruta de producción fuera del volumen.

Ningún secreto utilizará prefijo `VITE_`, porque esas variables pueden incorporarse al bundle del navegador. `.env.example` sólo contendrá nombres y valores ficticios.

### 20.11 Arranque y despliegue en Railway

Se propone una imagen Docker reproducible con Node 24 LTS y `pnpm`, aunque Railway pueda detectar el proyecto automáticamente. Esto fija el entorno de compilación de `better-sqlite3` y permite probar localmente exactamente el artefacto desplegado.

Secuencia de arranque:

1. Validar variables y comprobar que `/app/data` es el volumen esperado.
2. Abrir SQLite y aplicar pragmas.
3. Comprobar versión de esquema.
4. Crear una copia previa cuando una migración lo requiera.
5. Ejecutar migraciones pendientes en orden y abortar ante cualquier fallo.
6. Ejecutar el seed idempotente de la versión correspondiente.
7. Verificar las invariantes mínimas de catálogo.
8. Empezar a escuchar en `0.0.0.0:$PORT`.

Las migraciones se ejecutan al arrancar, no en build ni en el comando pre-deploy: Railway sólo monta el volumen durante runtime. Habrá una única réplica y nunca se activará escalado horizontal.

`GET /healthz` será público y mínimo. Sólo devolverá `2xx` cuando hayan terminado migraciones y seed y se pueda realizar una consulta trivial a SQLite; no expondrá versión de esquema, rutas ni configuración. Railway lo usará para validar despliegues. Se acepta una breve interrupción al desplegar porque un servicio con volumen no puede mantener simultáneamente dos deployments montados sobre él.

Al recibir una señal de terminación, el proceso dejará de aceptar trabajo, esperará las peticiones en curso dentro de un límite, realizará un checkpoint razonable y cerrará la conexión.

### 20.12 Backups y restauración operativa

Habrá dos capas complementarias:

1. **Snapshots del volumen de Railway:** programación diaria y semanal para una restauración rápida dentro del mismo proyecto.
2. **Backup lógico portable:** copia consistente de SQLite, `integrity_check`, subida a S3 y política de retención de siete diarios y cuatro semanales.

El job lógico se ejecuta dentro del único proceso, al arrancar y después mediante comprobaciones periódicas. La clave de objeto incluye fecha y versión de esquema, de modo que repetir el job sea idempotente. El temporal se elimina después de validar la subida y nunca se sirve por HTTP.

Una migración destructiva exige un backup lógico confirmado. La restauración continúa siendo una operación manual mediante runbook: detener, conservar la base actual, subir o seleccionar la copia, limpiar WAL/SHM, comprobar integridad, arrancar y verificar.

### 20.13 Calidad y pruebas

| Nivel | Cobertura principal |
|---|---|
| Dominio | Evaluaciones, niveles relativos, estados, supersets, pirámides y porcentaje de cancelación. |
| Aplicación | Casos de uso, autorización, concurrencia e idempotencia con dobles sólo de puertos externos. |
| Persistencia | Migraciones y repositorios contra SQLite real temporal, incluidas restricciones e índices parciales. |
| Contrato API | Status, esquemas, cursores, ETag, Problem Details y correspondencia con OpenAPI. |
| Componentes | Formularios y controles complejos accesibles. |
| End-to-end | Login, catálogo, evaluación, planificación, sesión recuperable y consulta del historial. |

Playwright ejecutará al menos un proyecto Chromium de escritorio y uno móvil con interacción táctil. Los recorridos críticos del modo entrenamiento probarán recarga, cambio de visibilidad, descanso vencido, cancelación y doble pulsación. El sonido y Wake Lock se aislarán detrás de adaptadores del navegador para poder probar sus fallos.

La integración continua ejecutará formato/lint, TypeScript, pruebas unitarias, integración SQLite, validación OpenAPI, build de producción y un conjunto end-to-end mínimo. El despliegue no se realiza si falla alguna de estas comprobaciones.

### 20.14 Seguridad y observabilidad

- Cabeceras CSP, `frame-ancestors`, `nosniff`, referrer policy y permisos del navegador ajustados a los vídeos realmente usados.
- HTTPS terminado por Railway y cookies seguras en producción.
- Límite de 1 MiB para JSON y límites menores específicos cuando proceda.
- Consultas parametrizadas; cualquier SQL dinámico sólo permite columnas u órdenes enumerados.
- URLs y logs nunca incluyen tokens, contraseña ni contenido de cabeceras sensibles.
- Cada petición recibe `requestId`; las transiciones importantes incluyen identificador de agregado y resultado, no datos audiovisuales ni notas completas.
- Errores inesperados se registran en servidor y devuelven un Problem Details neutro.
- No se añadirá Sentry, métricas distribuidas ni tracing en el primer MVP. Logs de Railway y el healthcheck bastan para una instalación personal.

### 20.15 Datos iniciales y repositorio

Los originales, `exercises.md` y la carpeta plana `files` permanecen como material fuente. El runtime no analizará Markdown en cada arranque.

Durante la implementación se generará y versionará un seed normalizado con identificadores estables y un manifiesto que relaciona cada medio con su fichero fuente. Una prueba comprobará:

- 71 variantes.
- 145 imágenes presentes y referenciadas una sola vez cuando corresponda.
- 19 URLs de vídeo válidas sintácticamente.
- 25 niveles de capacidad con requisitos masculinos completos.
- Slugs, posiciones e identificadores únicos.

Los PDFs, EPUBs, hojas de cálculo y archivos fuente no formarán parte de la imagen final de producción. Sólo se copiarán al artefacto los datos de seed necesarios; los medios de producción vivirán en S3.

Cuando se genere el proyecto se añadirá un `AGENTS.md` breve con las invariantes permanentes: aplicación monousuario, nombres de código en inglés, sin nuevas metodologías hipotéticas, API limitada y obligación de ejecutar las pruebas relevantes.

### 20.16 Riesgos asumidos

- TanStack Start continúa en versión `v0` y Nitro/Vite sigue evolucionando: se fijan versiones y cualquier actualización exige build y pruebas end-to-end.
- `better-sqlite3` contiene un módulo nativo: la imagen Docker y CI deben compilar o instalar el binario para el mismo runtime de producción.
- Railway provoca una breve interrupción al reemplazar un servicio con volumen: es aceptable para uso personal.
- Audio, Wake Lock y temporizadores en segundo plano dependen del navegador móvil: se diseñan como ayudas recuperables, no como fuente de verdad.
- S3 o internet pueden fallar durante un backup: se conserva la copia anterior y se reintenta sin bloquear el uso normal, salvo una migración destructiva que sí exige copia confirmada.

### 20.17 Documentación técnica consultada

- [TanStack Start: hosting Node/Nitro y Railway](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
- [TanStack Start: server routes](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes)
- [TanStack Start: middleware](https://tanstack.com/start/latest/docs/framework/react/guide/middleware)
- [Node.js: ciclos de soporte](https://nodejs.org/en/about/previous-releases)
- [Node.js 24: estado de `node:sqlite`](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)
- [Drizzle: drivers SQLite](https://orm.drizzle.team/docs/sqlite/get-started-sqlite)
- [Railway: volúmenes](https://docs.railway.com/volumes)
- [Railway: backups de volúmenes](https://docs.railway.com/volumes/backups)
- [Railway: healthchecks](https://docs.railway.com/deployments/healthchecks)
- [AWS SDK v3: S3 y URLs firmadas](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrate-s3.html)
- [Zod: generación de JSON Schema](https://zod.dev/json-schema)
- [zod-to-openapi: OpenAPI 3.1 y Zod 4](https://github.com/asteasolutions/zod-to-openapi)
- [shadcn/ui: instalación con TanStack Start](https://ui.shadcn.com/docs/installation)
- [Playwright: emulación móvil](https://playwright.dev/docs/emulation)

### 20.18 Decisiones confirmadas de esta fase

1. Se usarán Node.js 24 LTS y `pnpm`.
2. El acceso a SQLite se implementará con Drizzle ORM y `better-sqlite3`; `node:sqlite` queda para una posible reevaluación futura.
3. La base visual será Tailwind CSS y shadcn/ui, sin adoptar un kit de diseño cerrado.
4. Railway desplegará una imagen Docker propia y reproducible.
5. Habrá snapshots programados de Railway y backup lógico portable en S3.
6. La web incluirá manifest e iconos para poder instalarla, pero no service worker ni funcionamiento offline en el MVP.

La arquitectura queda aprobada para ordenar la implementación.

## 21. Fase 6 - Implementación por entregas verticales

### 21.1 Estrategia de entrega

La aplicación se construirá en cortes verticales utilizables. Cada entrega atraviesa, cuando corresponde:

- Migración y repositorios.
- Reglas y casos de uso.
- Interfaz móvil.
- API pública dentro de su alcance limitado.
- Pruebas automáticas.
- Documentación operativa afectada.

No se implementarán primero todas las tablas, después todas las rutas y finalmente todas las pantallas. El desarrollo y la validación de las entregas 0-5 serán locales. El primer despliegue en Railway se hará en la entrega 6, cuando el MVP funcional esté completo.

Reglas de avance:

- Una entrega debe ser demostrable de principio a fin antes de comenzar la siguiente.
- Las migraciones ya aplicadas no se reescriben; cualquier corrección usa una migración nueva.
- No se incorporan abstracciones destinadas únicamente a funciones fuera del MVP.
- Una pantalla incompleta no aparece en la navegación principal.
- Todo texto de producto estará en español y todo identificador de código en inglés.
- Cada entrega deja `main` construible, migrable y con sus pruebas en verde.
- Ninguna evaluación, planificación o sesión personal real se introduce en producción hasta validar backup y restauración; el seed del catálogo sí puede cargarse para verificar el despliegue.

### 21.2 Resumen y dependencias

| Entrega | Resultado demostrable | Depende de |
|---|---|---|
| 0. Esqueleto operativo | Login, SQLite, API autenticada mínima, CI y contenedor Docker validado localmente. | Plan aprobado. |
| 1. Catálogo | 71 variantes filtrables, detalle, galería y API de lectura. | 0. |
| 2. Evaluaciones | Flujo periódico completo, historial y niveles actuales. | 1. |
| 3. Planificación | Cola y editor de entrenamientos con API de escritura. | 1 y 2 para selecciones relativas. |
| 4. Modo entrenamiento | Ejecución recuperable de series, supersets y pirámides. | 3. |
| 5. Historial | Consulta completa de sesiones terminales y repetición mediante copia. | 4. |
| 6. Producción | Primer despliegue en Railway, S3, backups, restauración probada, seguridad y aceptación final móvil. | 0-5. |

La API se amplía junto con cada área; no existe una entrega posterior dedicada a replicar toda la UI.

### 21.3 Entrega 0 - Esqueleto operativo

#### Objetivo

Demostrar localmente que la arquitectura elegida, SQLite, las migraciones y la imagen de producción funcionan antes de construir el producto.

#### Trabajo

1. Preservar `plan.md`, los libros, `exercises.md` y `files`, y generar el proyecto TanStack Start en la raíz sin sobrescribirlos.
2. Fijar Node 24, `pnpm`, TypeScript estricto, TanStack Start, Nitro y las herramientas de formato y prueba.
3. Crear `AGENTS.md` con decisiones e invariantes permanentes del proyecto.
4. Incorporar Tailwind, el tema inicial y los componentes mínimos de shadcn/ui.
5. Definir y validar configuración con Zod; añadir `.env.example` sin secretos.
6. Crear la conexión SQLite, pragmas, ejecutor de migraciones y primera migración con ajustes, tokens e idempotencia.
7. Implementar UUIDv7, reloj y unidad de trabajo como dependencias de servidor.
8. Implementar login y logout mediante `APP_PASSWORD`, cookie segura, protección de rutas y comprobación CSRF.
9. Crear la pantalla mínima de ajustes para generar, mostrar una vez y revocar tokens API.
10. Montar middleware de `requestId`, logs, Bearer token, permisos, límites y Problem Details.
11. Publicar OpenAPI 3.1 autenticado con un contrato mínimo y su visor.
12. Crear `/healthz`, manifest e iconos provisionales.
13. Preparar Docker, scripts de build/arranque y cierre ordenado de SQLite.
14. Configurar CI con lint/formato, tipos, unitarias, migración limpia y build de producción.
15. Ejecutar localmente la imagen final con un directorio persistente montado en `/app/data`, reiniciarla y comprobar que la base sobrevive.

#### Pruebas y aceptación

- Una instalación limpia crea `/app/data/training.sqlite` y ejecuta migraciones una sola vez.
- Reiniciar no duplica datos ni modifica el esquema.
- Una configuración inválida impide arrancar con un mensaje operativo claro.
- Sin sesión, las rutas privadas redirigen al login.
- La contraseña correcta crea la cookie; una incorrecta no revela detalles.
- Una mutación con origen inválido es rechazada.
- Un token `read` no puede escribir y uno revocado deja de funcionar.
- OpenAPI y `/api/docs` exigen autenticación.
- Docker construye y arranca localmente usando el mismo comando de producción.
- El healthcheck del contenedor sólo responde correctamente después de abrir, migrar y consultar SQLite.

#### Punto de control

No se añade funcionalidad de catálogo hasta poder construir el contenedor, arrancarlo, reiniciarlo y migrar este esqueleto localmente sin intervención manual sobre la base.

### 21.4 Entrega 1 - Catálogo navegable

#### Objetivo

Convertir la extracción del libro en la primera función completa y útil de la aplicación.

#### Trabajo de datos

1. Validar `exercises.md` y todos los paths de la carpeta plana `files`.
2. Generar un seed normalizado y versionado con identificadores y slugs estables.
3. Crear migraciones de variantes, medios, definiciones de capacidad, requisitos y FTS5.
4. Implementar seed idempotente sin depender de Markdown durante el runtime.
5. Crear repositorios y consultas de detalle, filtros, búsqueda y cursor estable.
6. Implementar almacenamiento local y rutas autenticadas de medios.

#### Trabajo de interfaz

- Ruta de catálogo como destino inicial tras el login.
- Todos los resultados al entrar sin filtros.
- Texto, tipos y dificultad mínima/máxima reflejados en la URL.
- Tarjetas de variantes con miniatura, tipo, dificultad e indicador de medios.
- Scroll infinito y botón de respaldo para cargar más.
- Estado vacío, error recuperable y esqueletos de carga.
- Modal o sheet de detalle con descripción y galería.
- Imágenes ampliables, vídeos reproducibles, navegación anterior/siguiente, teclado y gesto razonable en móvil.
- Cierre que restaura foco y posición del catálogo.
- URL directa de una variante que abre su detalle.

#### API pública

- `GET /exercise-variants` con texto, tipos, dificultad y cursor.
- `GET /exercise-variants/{variantId}`.
- `GET /exercise-catalog-options`.
- `GET /capability-level-definitions`.
- `GET /media-assets/{mediaId}/content`.
- Esquemas, errores y ejemplos incorporados a OpenAPI.

#### Pruebas y aceptación

- El seed produce exactamente 71 variantes, 145 imágenes, 19 URLs de vídeo y 25 definiciones de nivel.
- Todos los ficheros referenciados existen y ningún path escapa de la carpeta permitida.
- Sin filtros aparecen las 71 variantes a través de los lotes sucesivos.
- La búsqueda encuentra nombre y descripción sin depender de mayúsculas.
- El filtro de dificultad usa solapamiento inclusivo; los valores nulos no aparecen al filtrar por nivel.
- Combinar texto, varios tipos y dificultad produce resultados deterministas sin duplicados.
- Un cursor no puede reutilizarse con otros filtros.
- La galería funciona con teclado y en viewport móvil.
- Un token de sólo lectura puede recorrer todo el catálogo, pero no descubre claves físicas ni paths internos.

### 21.5 Entrega 2 - Evaluaciones de capacidades

#### Objetivo

Permitir realizar, recuperar y consultar evaluaciones periódicas que determinen los cinco niveles actuales.

#### Trabajo

1. Añadir migraciones y repositorios de evaluaciones, capacidades, resultados y mediciones.
2. Implementar la máquina de estados y todos sus invariantes como dominio puro.
3. Calcular y congelar el nivel inicial independiente de cada capacidad.
4. Implementar inicio, respuesta superada/fallida, medición real, avance, finalización, cancelación y reanudación.
5. Crear lista e indicadores de evaluaciones en curso, completadas y canceladas.
6. Construir el asistente mobile-first con ejercicio, medios y requisito visible.
7. Crear modal de detalle histórico y resumen por capacidad.
8. Derivar la vista de niveles actuales de la última evaluación completada.
9. Añadir notas opcionales sin permitir modificar los hechos de una evaluación terminal.

#### API pública

- `GET /assessments` con filtros y cursor.
- `GET /assessments/{assessmentId}`.
- `GET /current-capability-levels`.
- No registrar ninguna ruta de escritura para evaluaciones.

#### Pruebas y aceptación

- La primera evaluación comienza en nivel 1 para las cinco capacidades.
- Una posterior comienza en `máximo anterior - 1`, limitada a 1-5 e independientemente por capacidad.
- Superar avanza; fallar exige valor real y termina esa capacidad.
- El máximo es el último nivel intentado, aunque no se alcance el criterio de progresión.
- Completar nivel 5 cierra la capacidad en 5.
- Refrescar o cerrar el navegador permite continuar exactamente en el punto persistido.
- Sólo existe una evaluación en curso.
- Una evaluación en curso o cancelada no cambia niveles actuales.
- Cambiar posteriormente una definición no altera el detalle histórico.
- La API permite consultar una evaluación en curso, pero cualquier escritura queda fuera de rutas y OpenAPI.

### 21.6 Entrega 3 - Planificación de entrenamientos

#### Objetivo

Crear y ordenar entrenamientos pendientes válidos sin iniciar todavía su ejecución.

#### Trabajo de dominio y persistencia

1. Añadir migraciones y repositorios de entrenamientos, bloques, elementos y objetivos.
2. Implementar agregados y validación de series normales, supersets y pirámides.
3. Admitir borradores incompletos y separar “guardable” de “iniciable”.
4. Implementar selección explícita y relativa a capacidad con offsets `-1`, `0`, `1`.
5. Añadir versión optimista por entrenamiento y versión de la cola.
6. Implementar creación, sustitución completa, duplicación, eliminación y reordenación atómica.
7. Implementar idempotencia persistente y su limpieza tras 24 horas.

#### Trabajo de interfaz

- Cola completa de pendientes con resumen.
- Crear y editar nombre, notas y bloques.
- Formularios específicos por metodología; no un formulario genérico lleno de campos nulos.
- Selector de variante reutilizando búsqueda y filtros del catálogo.
- Objetivos de repeticiones o duración, rangos y descansos.
- Superset limitado visualmente a dos variantes.
- Orden de bloques y entrenamientos mediante controles táctiles, con alternativa accesible de mover arriba/abajo.
- Validación contextual y resumen de conflictos para iniciar.
- Duplicar y eliminar con confirmación cuando proceda.
- Aviso de conflicto si otro cliente ha cambiado la versión.

#### API pública

- `GET` y `PUT /workout-queue`.
- `POST /workouts`.
- `GET`, `PUT` y `DELETE /workouts/{workoutId}`.
- `POST /workouts/{workoutId}/duplicate`.
- `GET /workouts/{workoutId}/validation`.
- ETag, `If-Match`, `Idempotency-Key`, scopes y OpenAPI completos.

#### Pruebas y aceptación

- Crear siempre añade al final y duplicar inmediatamente después del original.
- Reordenar exige exactamente todos los pendientes una vez y no deja posiciones intermedias ante un fallo.
- Un ETag antiguo responde `412` y conserva el agregado actual.
- Repetir una creación con la misma clave devuelve la misma respuesta y no duplica filas.
- Reutilizar la clave con otro cuerpo responde `409`.
- Un bloque normal o pirámide contiene una variante; un superset contiene exactamente dos.
- Las únicas metodologías posibles son `NORMAL_SETS`, `SUPERSET` y `PYRAMID`.
- Una referencia relativa sin nivel actual hace el entrenamiento no iniciable, pero no impide guardar el borrador.
- La API nunca ofrece una acción de inicio.

### 21.7 Entrega 4 - Modo entrenamiento

#### Objetivo

Ejecutar un entrenamiento completo desde el móvil, conservar cada transición y recuperarlo después de una recarga o suspensión.

Esta es la entrega de mayor riesgo y se implementará internamente en cuatro cortes, manteniendo oculta la navegación hasta completar todos:

1. Inicio atómico, snapshots, series normales y descanso.
2. Supersets como una única unidad combinada.
3. Pirámides temporizadas y peldaños dinámicos.
4. Recuperación, audio, Wake Lock, cancelación y pulido móvil.

#### Inicio de sesión

- Validar de nuevo que el entrenamiento es iniciable.
- Resolver selecciones relativas usando la evaluación completada vigente.
- Crear snapshots completos de bloques, variantes, objetivos y descansos.
- Pregenerar unidades normales y supersets; crear la pirámide recuperable.
- Consumir el entrenamiento y quitarlo de la cola en la misma transacción.
- Impedir una segunda sesión activa.

#### Pantalla de trabajo

- Mostrar bloque, metodología, variante, objetivo, progreso e instrucciones.
- Acceso sin perder estado a descripción y medios.
- Controles grandes de iniciar/finalizar y bloqueo frente a doble pulsación.
- Cronómetro derivado de las marcas del servidor.
- Resultado real opcional después de finalizar, sin bloquear el avance.
- Navegación automática a descanso o siguiente unidad según las reglas.

#### Descanso

- Cuenta atrás, tiempo excedido y aviso sonoro.
- Posibilidad de comenzar antes o después del objetivo.
- Cierre del descanso al comenzar el siguiente trabajo.
- Persistencia de duración prevista y real.

#### Supersets

- Dos variantes visibles en orden y sin descanso intermedio.
- Un solo inicio, cronómetro y finalización para la pareja.
- Una pareja completada incrementa el progreso en una unidad.
- Descanso únicamente después de la pareja.

#### Pirámides

- Peldaños ascendentes y descendentes generados según la configuración.
- Descanso calculado por repeticiones cuando corresponda.
- La pirámide completa cuenta como una unidad.
- Al cancelar, su contribución es `tiempo activo / tiempo objetivo`, limitada a 0-1.

#### Finalización y recuperación

- Completar al terminar todo el trabajo previsto.
- Cancelar desde cualquier fase con confirmación y motivo opcional.
- Calcular y congelar porcentaje, trabajo, descanso y duración total.
- El entrenamiento de origen permanece consumido aunque se cancele.
- Al recargar, reconstruir `READY`, `WORKING` o `RESTING` desde SQLite.
- Al volver de segundo plano, recalcular tiempos y emitir como máximo el aviso pertinente, sin repetir transiciones.

#### API pública

No se añade ninguna ruta. Se incorporan pruebas negativas que aseguren que una sesión activa no aparece en catálogo de rutas, historial ni OpenAPI y responde `404` si se prueba un identificador conocido.

#### Pruebas y aceptación

- Inicio, snapshot y consumo son indivisibles.
- Cambiar catálogo, evaluación o entrenamiento después del inicio no altera la sesión.
- Sólo existe una unidad activa o descanso abierto.
- Refrescar durante trabajo, descanso y pirámide conserva la fase y el tiempo correcto.
- Un doble toque no completa dos unidades.
- El aviso se comporta correctamente tras bloquear y desbloquear el móvil.
- Fallar Wake Lock o audio degrada la ayuda, no el entrenamiento.
- El superset nunca pide una finalización por variante.
- Los porcentajes de sesión completa, cancelación normal y cancelación de pirámide coinciden con las fórmulas aprobadas.
- Una sesión terminal no admite nuevas transiciones.

### 21.8 Entrega 5 - Historial y repetición

#### Objetivo

Hacer consultable todo lo ocurrido sin permitir reescribirlo.

#### Trabajo de interfaz

- Lista de sesiones completadas y canceladas, más reciente primero.
- Filtros por fecha, estado y tipo de ejercicio con scroll infinito.
- Resumen de duración, tiempo activo, descanso y porcentaje.
- Detalle ordenado de snapshots, unidades, objetivos, resultados, pasos y descansos.
- Comparación clara entre objetivo y resultado real cuando exista.
- Motivo de cancelación y notas.
- Edición exclusivamente del texto de notas.
- Acción “Repetir” que copia el entrenamiento de origen a un pendiente nuevo, sin revivir el consumido.
- Enlace a la evaluación usada para resolver niveles cuando exista.

#### API pública

- `GET /workout-sessions` sólo para `COMPLETED` y `CANCELLED`.
- `GET /workout-sessions/{sessionId}` con todo el detalle estructurado.
- Filtros, cursores y OpenAPI.
- Sin mutaciones de notas, hechos o sesiones.

#### Pruebas y aceptación

- Una sesión activa no aparece ni con filtros manipulados.
- Los filtros combinados no duplican sesiones y mantienen orden estable.
- El detalle histórico se mantiene aunque una variante se desactive o cambie de nombre.
- Las mediciones ausentes se distinguen de un resultado cero.
- Repetir crea un pendiente nuevo al final de la cola y deja intacto el historial.
- La copia conserva la selección original, incluida una referencia relativa y su offset; al iniciar la futura sesión se resolverá contra el nivel entonces vigente.
- Si una selección explícita ya no está activa, se conserva el borrador pero se marca el conflicto para que el usuario la sustituya.
- Sólo las notas pueden cambiar; bloques, tiempos, objetivos y mediciones permanecen inmutables.

### 21.9 Entrega 6 - Preparación de producción

#### Objetivo

Convertir el conjunto funcional en una instalación confiable para uso diario desde el móvil.

#### Almacenamiento y datos

1. Crear el proyecto y servicio de Railway por primera vez.
2. Configurar una única réplica, variables, dominio, healthcheck y volumen montado en `/app/data`.
3. Desplegar la imagen ya validada localmente y comprobar migraciones, seed y reinicio sobre el volumen.
4. Crear bucket privado y credenciales de mínimo privilegio.
5. Copiar los medios a S3 con checksums y verificar que todos puedan resolverse.
6. Cambiar el catálogo a `storage_kind = S3` sin modificar identificadores.
7. Probar URLs firmadas desde UI y API.
8. Activar snapshots diarios y semanales del volumen de Railway.
9. Activar backup lógico diario a S3 con retención y alertas por log.
10. Ejecutar un ensayo completo de restauración sobre una copia separada y documentar el resultado.

#### Endurecimiento

- Cabeceras de seguridad y CSP compatibles sólo con los vídeos necesarios.
- Revisión de cookies, CSRF, Bearer tokens y ausencia de secretos en bundles y logs.
- Límites de cuerpo, texto, cardinalidad y frecuencia de login.
- Limpieza de claves de idempotencia expiradas.
- Comprobación de que ninguna operación histórica ejecuta `DELETE`.
- Validación de OpenAPI y recorrido con un cliente externo real.
- Revisión de accesibilidad: foco, teclado, etiquetas, contraste y `prefers-reduced-motion`.
- Revisión de instalación desde pantalla de inicio.
- Logs estructurados y runbooks definitivos.

#### Aceptación móvil y operativa

- Recorridos completos en Chromium móvil y WebKit móvil emulados.
- Prueba manual al menos en el teléfono real del propietario.
- Uso con pantalla bloqueada y vuelta al primer plano durante trabajo y descanso.
- Despliegue nuevo sobre volumen existente sin perder datos.
- Migración fallida simulada que no deja la aplicación atendiendo con esquema parcial.
- Backup descargable y restauración verificada.
- Rotación de contraseña, secreto de sesión y token API documentada.
- La imagen final no contiene PDF, EPUB, hojas de cálculo ni credenciales.

### 21.10 Estrategia transversal de pruebas

#### Dominio

Tablas de casos exhaustivas para:

- Inicio de evaluaciones con y sin historial.
- Máximo de capacidad al superar o fallar cada nivel.
- Límites de offset 1 y 5.
- Validación de los tres métodos.
- Estados permitidos y transiciones inválidas.
- Cómputo de unidades y fracción de pirámide.

#### Persistencia

- Toda migración desde una base vacía.
- Actualización desde cada versión que haya llegado a producción.
- Restricciones únicas parciales y claves foráneas.
- Rollback de transacciones con un fallo inducido a mitad.
- FTS sincronizado después de insertar, corregir o desactivar una variante.
- Backup, `integrity_check` y apertura de la copia restaurada.

#### API

- Matriz de ruta por token ausente, inválido, revocado, `read` y `workouts:write`.
- Peticiones válidas y campos desconocidos.
- Cursores ligados a filtros.
- ETags correctos y obsoletos.
- Idempotencia repetida y reutilizada incorrectamente.
- Todas las respuestas de error conformes a Problem Details.
- Comparación automática entre rutas registradas y OpenAPI.

#### Interfaz

- Estados de carga, vacío, error y reintento.
- Formularios accesibles y mensajes asociados al campo.
- Restauración de foco en modales.
- Navegación con teclado en galería y listas ordenables.
- Viewports estrechos sin scroll horizontal accidental.
- Controles críticos utilizables con una mano y sin pulsaciones ambiguas.

### 21.11 Datos de prueba

Habrá tres grupos separados:

1. **Fixtures mínimas:** pocas variantes y criterios para unitarias rápidas.
2. **Seed completo del libro:** verifica conteos, relaciones, medios y búsquedas reales.
3. **Escenarios de sesión:** fábricas deterministas de entrenamientos, evaluaciones y tiempos mediante reloj inyectado.

Las pruebas nunca usan la base de desarrollo o producción. Cada suite crea un fichero temporal explícito, aplica migraciones y lo elimina al terminar.

### 21.12 Disciplina de cambios

- Commits pequeños centrados en un comportamiento verificable.
- Una migración y su código compatible viajan juntos.
- No se mezcla una actualización masiva de dependencias con una función de dominio.
- Toda corrección de bug añade primero una reproducción automatizada cuando sea viable.
- Los cambios a OpenAPI incluyen prueba del contrato y ejemplo actualizado.
- Los cambios de estado requieren revisar máquina de estados, persistencia, recuperación y API negativa.
- Las dependencias se añaden sólo cuando resuelven un problema presente y se documenta su función.
- Las actualizaciones de TanStack Start, Nitro, Drizzle y `better-sqlite3` se hacen conscientemente, una familia cada vez, con build Docker y end-to-end.

### 21.13 Definición común de terminado

Una entrega se considera terminada cuando:

- Sus criterios funcionales se cumplen desde la UI real.
- La API correspondiente coincide con OpenAPI.
- No expone capacidades expresamente excluidas.
- Las migraciones funcionan en base limpia y base de la versión anterior.
- Pruebas de dominio, integración y recorrido crítico están en verde.
- Se ha probado en viewport móvil.
- Estados de error son recuperables y no pierden hechos confirmados.
- Accesibilidad básica y navegación por teclado están verificadas.
- No se registran secretos ni se incluyen en el cliente.
- El plan y runbooks reflejan cualquier decisión modificada durante la implementación.

### 21.14 Criterios de finalización del MVP

El MVP está terminado únicamente cuando se cumplen todos estos puntos:

#### Producto

- Catálogo completo, filtros, scroll infinito, detalle y galería.
- Evaluaciones recuperables, historial y niveles actuales correctos.
- Cola editable de entrenamientos con las tres metodologías.
- Modo entrenamiento completo, recuperable y cancelable.
- Historial terminal detallado y repetición mediante copia.
- Experiencia instalable y usable desde el móvil fuera de casa.

#### API

- Catálogo, definiciones, evaluaciones, niveles, pendientes e historial disponibles según el contrato.
- Evaluaciones sin escritura pública.
- Sesiones activas completamente ausentes.
- Autenticación, permisos, cursores, concurrencia e idempotencia probados.
- OpenAPI 3.1 autenticado y válido.

#### Datos y operación

- Conteos y relaciones del seed verificados.
- SQLite reside en el volumen y sobrevive a reinicios y despliegues.
- Medios privados disponibles desde S3.
- Backups automáticos activos y una restauración ensayada.
- Docker, CI, healthcheck y runbooks listos.
- La base real no contiene datos de prueba.

#### Calidad

- Sin errores conocidos que puedan perder o corromper evaluaciones, entrenamientos o sesiones.
- Recorridos críticos verdes en escritorio, móvil Chromium y móvil WebKit.
- Prueba manual satisfactoria en el teléfono de uso real.
- No existen `TODO` de funcionalidad necesaria para los recorridos del MVP.

### 21.15 Exclusiones protegidas durante la implementación

No deben colarse en las entregas:

- Multiusuario, roles, registro u organizaciones.
- Escalado horizontal o más de una réplica.
- Calendario.
- Entrenamiento improvisado sin planificación.
- Modo offline o service worker.
- Circuitos, EMOM, AMRAP, Tabata u otras metodologías.
- Edición del catálogo desde la aplicación.
- Escritura de evaluaciones o control de sesiones mediante API.
- Gráficos avanzados o endpoint calculado de progreso.
- Borrado de evaluaciones o sesiones históricas.
- Aplicaciones nativas o Electron.

Una necesidad nueva se registra para después del MVP y sólo entra si se revisan explícitamente alcance, dominio, persistencia, API y calendario de entregas.

### 21.16 Decisión final confirmada

El desarrollo de las entregas 0-5 será local. Railway no se configurará ni recibirá ningún despliegue hasta la entrega 6.

### 21.17 Decisiones finales pendientes

1. Confirmar que la API crecerá dentro de cada entrega, no como una fase separada al final.
2. Confirmar que el modo entrenamiento se implementará en cuatro cortes internos pero no se expondrá en navegación hasta estar completo.
3. Confirmar que no se introducirán evaluaciones, planificaciones ni sesiones personales reales en producción hasta completar un ensayo de restauración.
