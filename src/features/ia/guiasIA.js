import { LIGA_MCP } from '@/features/ia/queHaceLaIA';

/**
 * Las recetas para conectar cada IA, paso por paso.
 *
 * Andrés, 25 sep 2026, sobre la primera versión: "las instrucciones se ven
 * feas, tienen que ser súper amigables visualmente"; "se tiene que dividir en
 * 2 vertientes: los conectores (Claude y ChatGPT) y los MCP (Claude Code,
 * Codex, Hermes)"; y "a los atletas no les pusiste cómo conectarse a la IA,
 * ellos casi no usarán la versión de computadora".
 *
 * Por eso cada paso trae la pantalla que la persona va a ver (`pantalla`, la
 * dibuja `Maquetas.jsx`) con lo que tiene que tocar marcado (`resalta`), y los
 * pasos cambian según el aparato: en el celular se escriben para el celular.
 *
 * LO QUE DE VERDAD SE PUEDE EN EL CELULAR (revisado el 25 sep 2026):
 * - Claude: la app NO deja agregar conectores; se agregan en claude.ai desde
 *   el navegador y luego aparecen solos en la app. La liga
 *   claude.ai/settings/connectors abre el navegador (la app de iPhone no la
 *   reclama) y claude.ai/new abre la app: por eso son esas dos.
 * - ChatGPT: agregar un servidor MCP propio es solo en la computadora (web,
 *   planes de pago). En el celular, hasta que OpenAI apruebe Training Lab en
 *   su tienda.
 *
 * ChatGPT, revisado con la cuenta de Andrés el 6 oct 2026: ya NO hay «modo de
 * desarrollador». En chatgpt.com/plugins («Complementos») está el botón
 * «Agregar ▾» → «Crear servidor MCP personalizado»; el formulario pide Nombre,
 * Conexión (URL del servidor), Autenticación (OAuth), la casilla «Entiendo y
 * quiero continuar» y termina con «Crear como complemento». Luego manda a
 * nuestra pantalla de permiso y el complemento aparece en el chat bajo
 * «Complementos» (menú «+» o escribiendo @).
 */

// ChatGPT primero: es el que va a usar casi todo el mundo (Andrés, 6 oct 2026: «es más barato»).
export const CONECTORES = [
  { id: 'chatgpt', nombre: 'ChatGPT', color: '#111318' },
  { id: 'claude', nombre: 'Claude', color: '#D97757' },
];

export const TERMINALES = [
  { id: 'claude-code', nombre: 'Claude Code', color: '#C4623F' },
  { id: 'codex', nombre: 'Codex', color: '#111318' },
  { id: 'hermes', nombre: 'Hermes', color: '#7C5CFF' },
];

const abrir = (href, texto) => ({ tipo: 'abrir', href, texto });
const copiar = (valor, texto) => ({ tipo: 'copiar', valor, texto });

/* Los pasos de Claude y de ChatGPT se hacen en una computadora (en el celular se leen, y la pantalla avisa).
   Por eso dicen «Haz clic» siempre. Un paso por clic: Andrés, 6 oct 2026, «no saltarnos, pero visualmente
   simplificarlo muchísimo». */
export function pasosDe(app) {
  if (app === 'claude') {
    return [
      {
        titulo: 'Abre Claude y haz clic en «Personalización»',
        texto: 'Está en la barra de la izquierda.',
        pantalla: 'claude-inicio', resalta: 'personalizar',
        acciones: [abrir('https://claude.ai', 'Abrir Claude')],
      },
      {
        titulo: 'Haz clic en «Conectores»',
        texto: 'Arriba, junto a Habilidades y Plugins.',
        pantalla: 'claude-conectores', resalta: 'conectores',
      },
      {
        titulo: 'Haz clic en «+ Agregar»',
        texto: 'Arriba a la derecha.',
        pantalla: 'claude-conectores', resalta: 'agregar',
      },
      {
        titulo: 'Elige «Agregar conector personalizado»',
        pantalla: 'claude-conectores', resalta: 'personalizado',
      },
      {
        titulo: 'Escribe el nombre: Training Lab',
        pantalla: 'claude-formulario', resalta: 'nombre',
      },
      {
        titulo: 'Pega tu liga en «URL del servidor MCP»',
        pantalla: 'claude-formulario', resalta: 'url',
        acciones: [copiar(LIGA_MCP, 'Copiar liga')],
      },
      {
        titulo: 'Haz clic en «Continuar»',
        pantalla: 'claude-formulario', resalta: 'continuar',
      },
      {
        titulo: 'Haz clic en «Agregar»',
        texto: 'La autenticación déjala como viene.',
        pantalla: 'claude-formulario', resalta: 'agregar',
      },
      {
        titulo: 'Haz clic en «Conectar»',
        texto: 'Junto a Training Lab, en tu lista de conectores.',
        pantalla: 'claude-conectores', resalta: 'conectar',
      },
      {
        titulo: 'Haz clic en «Permitir»',
        texto: 'Se abre Training Lab. Si te pide entrar, entra con tu cuenta. Si muestra otra cuenta, toca «¿No eres tú?».',
        pantalla: 'permiso', resalta: 'permitir',
      },
      {
        titulo: '¡Listo! En un chat: «+» → Conectores → activa Training Lab',
        pantalla: 'chat', resalta: 'interruptor',
      },
    ];
  }
  if (app === 'chatgpt') {
    return [
      {
        titulo: 'Abre ChatGPT y haz clic en «Complementos»',
        texto: 'Está en la barra de la izquierda. El botón te lleva directo.',
        pantalla: 'chatgpt-complementos', resalta: 'complementos',
        acciones: [abrir('https://chatgpt.com/plugins', 'Abrir ChatGPT')],
      },
      {
        titulo: 'Haz clic en «Agregar»',
        texto: 'Arriba a la derecha.',
        pantalla: 'chatgpt-complementos', resalta: 'agregar',
      },
      {
        titulo: 'Elige «Crear servidor MCP personalizado»',
        texto: 'Es la tercera opción del menú.',
        pantalla: 'chatgpt-complementos', resalta: 'crear',
      },
      {
        titulo: 'Escribe el nombre: Training Lab',
        pantalla: 'chatgpt-crear', resalta: 'nombre',
      },
      {
        titulo: 'Pega tu liga en «URL del servidor»',
        texto: 'Autenticación déjala en OAuth: ya viene así.',
        pantalla: 'chatgpt-crear', resalta: 'url',
        acciones: [copiar(LIGA_MCP, 'Copiar liga')],
      },
      {
        titulo: 'Marca «Entiendo y quiero continuar»',
        pantalla: 'chatgpt-crear', resalta: 'casilla',
      },
      {
        titulo: 'Haz clic en «Crear como complemento»',
        texto: 'Si no ves el botón, achica la página (Cmd o Ctrl y –).',
        pantalla: 'chatgpt-crear', resalta: 'crear',
      },
      {
        titulo: 'Haz clic en «Permitir»',
        texto: 'Se abre Training Lab. Si te pide entrar, entra con tu cuenta. Si muestra otra cuenta, toca «¿No eres tú?».',
        pantalla: 'permiso', resalta: 'permitir',
      },
      {
        titulo: '¡Listo! En un chat, escribe @ y elige Training Lab',
        texto: 'También está en el menú «+», bajo Complementos.',
        pantalla: 'chat', resalta: 'app',
      },
    ];
  }
  const pregunta = {
    titulo: '¡Listo! Pregúntale lo que quieras',
    pantalla: 'terminal-pregunta',
  };
  if (app === 'claude-code') {
    const cmd = `claude mcp add --transport http training-lab ${LIGA_MCP}`;
    return [
      {
        titulo: 'Pega esto en tu terminal',
        pantalla: 'terminal', lineas: [['cmd', cmd], ['out', 'Added HTTP MCP server training-lab']],
        acciones: [copiar(cmd, 'Copiar comando')],
      },
      {
        titulo: 'Autoriza el acceso',
        texto: 'Abre Claude Code, escribe /mcp y elige training-lab → Authenticate. Se abre Training Lab: haz clic en Permitir.',
        pantalla: 'terminal', lineas: [['ask', '/mcp'], ['out', 'MCP servers'], ['sel', 'training-lab · Authenticate']],
      },
      pregunta,
    ];
  }
  if (app === 'codex') {
    const add = `codex mcp add training-lab --url ${LIGA_MCP}`;
    const login = 'codex mcp login training-lab';
    return [
      {
        titulo: 'Pega esto en tu terminal',
        pantalla: 'terminal', lineas: [['cmd', add], ['out', 'Added MCP server training-lab']],
        acciones: [copiar(add, 'Copiar comando')],
      },
      {
        titulo: 'Inicia sesión',
        texto: 'Se abre Training Lab: haz clic en Permitir.',
        pantalla: 'terminal', lineas: [['cmd', login], ['out', 'Abriendo el navegador para autorizar…'], ['ok', 'Listo: training-lab conectado']],
        acciones: [copiar(login, 'Copiar comando')],
      },
      pregunta,
    ];
  }
  const add = `hermes mcp add --url ${LIGA_MCP} --auth oauth training-lab`;
  return [
    {
      titulo: 'Pega esto en tu terminal',
      pantalla: 'terminal', lineas: [['cmd', add], ['out', 'Added MCP server training-lab (oauth)']],
      acciones: [copiar(add, 'Copiar comando')],
    },
    {
      titulo: 'Autoriza la primera vez',
      texto: 'Al usarlo por primera vez se abre Training Lab: haz clic en Permitir.',
      pantalla: 'terminal', lineas: [['out', 'Abriendo el navegador para autorizar…'], ['ok', 'Listo: training-lab conectado']],
    },
    pregunta,
  ];
}
