import { useEffect, useState } from 'react';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmacion } from '@/components/Confirmacion';
import { borrarMiRepertorio, borrarTodasMisVersiones, contarMiRepertorio } from '@/lib/api';
import { plural } from '@/lib/plural';
import { KP } from '@/lib/theme';
import { useAviso } from '@/components/AvisoPasajero';
import { Fila, Grupo, IconoDeFila, Interruptor } from '@/components/ui';

/**
 * «Mis ejercicios», en Mi perfil: lo que el inicio promete que siempre se puede (Andrés, 8 oct 2026: «siempre va a poder
 * borrar todo, crear su propia versión de todo, regresar a la versión original de la app»).
 *
 *   1. Ejercicios de Training Lab: prendidos o apagados. Apagados, el coach solo ve lo suyo; nada se borra.
 *   2. Volver al original: se borran TODAS sus versiones de los ejercicios de Training Lab.
 *   3. Borrar todo lo mío: sus ejercicios (con videos), categorías, grupos musculares y tipos de sesión. Para siempre.
 *
 * Los dos borrados preguntan con números («¿Borrar 14 ejercicios…?»), no en abstracto.
 */

export default function MisEjercicios() {
  const { profile, updateProfile } = useAuth();
  const pregunta = useConfirmacion();
  const [cuentas, setCuentas] = useState(null); // { ejercicios, categorias, grupos, tipos, versiones } | null = cargando
  const [ocupado, setOcupado] = useState(''); // '' | 'base' | 'versiones' | 'todo'
  const { avisa: aviso } = useAviso();
  const setErr = (m) => { if (m) aviso(m); };

  const recontar = () => contarMiRepertorio().then(setCuentas).catch((e) => setErr(e.message || 'No se pudo cargar'));
  useEffect(() => { recontar(); }, []);

  const avisa = (msg) => aviso(msg);

  async function cambiarBase(puesto) {
    setOcupado('base');
    const { error } = await updateProfile({ repertorio_base: puesto });
    setOcupado('');
    if (error) setErr(error.message); else avisa(puesto ? 'Ejercicios de Training Lab prendidos' : 'Ejercicios de Training Lab apagados');
  }

  async function volverAlOriginal() {
    const n = cuentas?.versiones ?? 0;
    const ok = await pregunta({
      titulo: '¿Volver al original?',
      detalle: `Se ${n === 1 ? 'borra tu versión' : `borran tus ${n} versiones`} de ejercicios de Training Lab y vuelven a verse como vienen. Los planes no cambian.`,
      confirmar: 'Sí, volver',
    });
    if (!ok) return;
    setOcupado('versiones');
    try {
      await borrarTodasMisVersiones();
      await recontar();
      avisa('Listo: los ejercicios de Training Lab vuelven a verse como vienen.');
    } catch (e) {
      setErr(e.message || 'No se pudo');
    } finally {
      setOcupado('');
    }
  }

  async function borrarTodo() {
    const c = cuentas || {};
    const partes = [
      c.ejercicios ? `${plural(c.ejercicios, 'ejercicio', 'ejercicios')} con sus videos` : '',
      c.categorias ? plural(c.categorias, 'categoría', 'categorías') : '',
      c.grupos ? plural(c.grupos, 'grupo muscular', 'grupos musculares') : '',
      c.tipos ? plural(c.tipos, 'tipo de sesión', 'tipos de sesión') : '',
    ].filter(Boolean);
    const ok = await pregunta({
      titulo: '¿Borrar todo lo tuyo?',
      detalle: `Se borran para siempre ${partes.join(', ')}. Los planes que ya los usan conservan el nombre del ejercicio, pero sin ficha ni video. Los ejercicios de Training Lab no se tocan.`,
      confirmar: 'Sí, borrar todo',
      peligro: true,
    });
    if (!ok) return;
    setOcupado('todo');
    try {
      await borrarMiRepertorio();
      await recontar();
      avisa('Listo: tu lista quedó vacía.');
    } catch (e) {
      setErr(e.message || 'No se pudo borrar');
    } finally {
      setOcupado('');
    }
  }

  const base = profile?.repertorio_base !== false;
  const c = cuentas || {};
  const hayMio = (c.ejercicios || 0) + (c.categorias || 0) + (c.grupos || 0) + (c.tipos || 0) > 0;
  const resumenMio = cuentas
    ? (hayMio
      ? [plural(c.ejercicios || 0, 'ejercicio', 'ejercicios'), plural(c.categorias || 0, 'categoría', 'categorías'), plural(c.grupos || 0, 'grupo', 'grupos'), plural(c.tipos || 0, 'tipo de sesión', 'tipos de sesión')].join(' · ')
      : 'Todavía no tienes nada tuyo.')
    : 'Contando…';

  /* Reestructura visual (15 oct 2026), como «Mis ejercicios» de las capturas: un grupo con el interruptor de los de Training Lab y lo que tiene suyo,
     y los dos borrados (volver al original, borrar todo lo mío) como renglones que preguntan antes. */
  return (
    <>
      <Grupo pie="Si lo apagas, tu lista empieza vacía y solo salen los que tú agregues. Nada se borra.">
        <Fila
          texto="Ejercicios de Training Lab" detalle="Listos para usar en tus planes, con video"
          derecha={ocupado === 'base' ? <Loader2 size={18} className="spin" color={KP.ink2} /> : <Interruptor activo={base} onCambio={cambiarBase} etiqueta="Ejercicios de Training Lab" />}
        />
        <Fila texto="Mis ejercicios" valor={cuentas ? String(c.ejercicios || 0) : '…'} valorTono="neutro" />
        <Fila texto="Mis categorías" valor={cuentas ? String(c.categorias || 0) : '…'} valorTono="neutro" />
        <Fila texto="Mis grupos musculares" valor={cuentas ? String(c.grupos || 0) : '…'} valorTono="neutro" />
      </Grupo>

      <Grupo titulo="Volver a empezar">
        <Fila
          izquierda={<IconoDeFila><RotateCcw size={18} /></IconoDeFila>} texto="Volver al original"
          detalle={cuentas ? (c.versiones ? `Cambiaste ${plural(c.versiones, 'ejercicio', 'ejercicios')} de Training Lab` : 'No has cambiado ninguno') : 'Contando…'}
          derecha={ocupado === 'versiones' ? <Loader2 size={18} className="spin" color={KP.ink2} /> : undefined}
          onClick={volverAlOriginal} deshabilitada={!c.versiones || !!ocupado}
        />
        <Fila
          izquierda={<IconoDeFila color={KP.danger} fondo={KP.dangerSoft}><Trash2 size={18} /></IconoDeFila>} texto="Borrar todo lo mío" tono="peligro"
          detalle={resumenMio} derecha={ocupado === 'todo' ? <Loader2 size={18} className="spin" color={KP.ink2} /> : undefined}
          onClick={borrarTodo} deshabilitada={!hayMio || !!ocupado}
        />
      </Grupo>
    </>
  );
}
