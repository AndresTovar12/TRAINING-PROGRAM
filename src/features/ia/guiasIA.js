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
 * - ChatGPT: conectar apps propias es solo en la computadora (modo de
 *   desarrollador, web). En el celular, hasta que OpenAI apruebe Training Lab
 *   en su tienda.
 */

export const CONECTORES = [
  { id: 'claude', nombre: 'Claude', color: '#D97757' },
  { id: 'chatgpt', nombre: 'ChatGPT', color: '#111318' },
];

export const TERMINALES = [
  { id: 'claude-code', nombre: 'Claude Code', color: '#C4623F' },
  { id: 'codex', nombre: 'Codex', color: '#111318' },
  { id: 'hermes', nombre: 'Hermes', color: '#7C5CFF' },
];

const abrir = (href, texto) => ({ tipo: 'abrir', href, texto });
const copiar = (valor, texto) => ({ tipo: 'copiar', valor, texto });

/** ¿Se puede conectar esta IA desde este aparato? */
export const sePuedeAqui = (app, esCompu) => esCompu || app !== 'chatgpt';

export function pasosDe(app, esCompu) {
  // En la compu se hace clic; en el celular se toca.
  const toca = (que) => (esCompu ? `Haz clic en ${que}` : `Toca ${que}`);
  if (app === 'claude') {
    return [
      {
        titulo: esCompu ? 'Abre los conectores de Claude' : 'Abre Claude en el navegador',
        texto: esCompu
          ? 'Configuración → Conectores. El botón te lleva directo.'
          : 'Se agrega en la página de Claude, no en la app. Después aparece solo en la app.',
        pantalla: 'claude-conectores', resalta: 'direccion',
        acciones: [abrir('https://claude.ai/settings/connectors', 'Abrir Claude')],
      },
      {
        titulo: toca('«Agregar conector personalizado»'),
        pantalla: 'claude-conectores', resalta: 'agregar',
      },
      {
        titulo: 'Pega tu liga',
        texto: `De nombre ponle Training Lab. ${esCompu ? 'Haz clic en' : 'Toca'} «Agregar».`,
        pantalla: 'formulario', resalta: 'url',
        acciones: [copiar(LIGA_MCP, 'Copiar liga')],
      },
      {
        titulo: esCompu ? 'Haz clic en «Conectar» y luego en «Permitir»' : 'Toca «Conectar» y luego «Permitir»',
        texto: 'Se abre Training Lab. Si te lo pide, entra con tu cuenta.',
        pantalla: 'permiso', resalta: 'permitir',
      },
      {
        titulo: esCompu ? '¡Listo! Úsalo en cualquier chat' : '¡Listo! Úsalo en la app de Claude',
        texto: 'En un chat: «+» → Conectores → activa Training Lab.',
        pantalla: 'chat', resalta: 'interruptor',
        acciones: [abrir('https://claude.ai/new', esCompu ? 'Abrir Claude' : 'Abrir la app de Claude')],
      },
    ];
  }
  if (app === 'chatgpt') {
    return [
      {
        titulo: 'Abre la configuración de ChatGPT',
        texto: 'En la compu: Configuración → Apps.',
        pantalla: 'chatgpt-ajustes', resalta: 'apps',
        acciones: [abrir('https://chatgpt.com', 'Abrir ChatGPT')],
      },
      {
        titulo: 'Activa «Modo de desarrollador»',
        texto: 'Está en Configuración avanzada.',
        pantalla: 'chatgpt-ajustes', resalta: 'interruptor',
      },
      {
        titulo: 'Crea la app: pega tu liga',
        texto: 'Nombre: Training Lab. Autenticación: OAuth.',
        pantalla: 'chatgpt-crear', resalta: 'url',
        acciones: [copiar(LIGA_MCP, 'Copiar liga')],
      },
      {
        titulo: toca('«Permitir»'),
        texto: 'Se abre Training Lab. Si te lo pide, entra con tu cuenta.',
        pantalla: 'permiso', resalta: 'permitir',
      },
      {
        titulo: '¡Listo! Úsalo en un chat',
        texto: 'En un chat: «+» → Training Lab.',
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
