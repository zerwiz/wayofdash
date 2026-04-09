import { useEffect, useId, useRef } from 'react';
import mermaid from 'mermaid';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, RotateCcw, Scan } from 'lucide-react';

const btnClass =
  'p-2 rounded-lg text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:border-slate-600';

function DiagramZoomToolbar() {
  const { zoomIn, zoomOut, resetTransform, centerView } = useControls();

  return (
    <div className="flex items-center gap-1 shrink-0">
      <button type="button" onClick={() => zoomOut(0.2, 200)} className={btnClass} title="Zoom out" aria-label="Zoom out">
        <ZoomOut size={18} strokeWidth={2.25} />
      </button>
      <button type="button" onClick={() => zoomIn(0.2, 200)} className={btnClass} title="Zoom in" aria-label="Zoom in">
        <ZoomIn size={18} strokeWidth={2.25} />
      </button>
      <button type="button" onClick={() => centerView(1, 200)} className={btnClass} title="Center" aria-label="Center view">
        <Scan size={18} strokeWidth={2.25} />
      </button>
      <button type="button" onClick={() => resetTransform(200)} className={btnClass} title="Reset pan & zoom" aria-label="Reset pan and zoom">
        <RotateCcw size={18} strokeWidth={2.25} />
      </button>
    </div>
  );
}

export default function MermaidDiagram({ definition, isDark = false }) {
  const containerRef = useRef(null);
  const reactId = useId().replace(/:/g, '');
  const serial = useRef(0);
  const text = typeof definition === 'string' ? definition.trim() : '';

  useEffect(() => {
    const el = containerRef.current;

    if (!el) return;

    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'neutral',
      securityLevel: 'loose',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      flowchart: { htmlLabels: true, curve: 'basis' },
      /* Default maxTextSize is 50_000; large mindmaps (e.g. deep Fibonacci trees) exceed it. */
      maxTextSize: 2_000_000,
    });

    if (!text) {
      el.innerHTML =
        '<p class="text-slate-400 dark:text-slate-500 text-sm">No diagram definition.</p>';
      return;
    }

    const renderId = `mmd-${reactId}-${++serial.current}`;
    let cancelled = false;

    el.innerHTML =
      '<p class="text-slate-400 dark:text-slate-500 text-sm py-6 text-center">Rendering diagram…</p>';

    mermaid
      .render(renderId, text)
      .then(({ svg, bindFunctions }) => {
        if (cancelled || containerRef.current !== el) return;
        el.innerHTML = svg;
        bindFunctions?.(el);
      })
      .catch((err) => {
        if (cancelled || containerRef.current !== el) return;
        const msg = err?.message || String(err);
        const safe = msg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        el.innerHTML = `<pre class="text-red-700 dark:text-red-300 text-xs whitespace-pre-wrap p-4 bg-red-50 dark:bg-red-950/50 rounded-xl border border-red-100 dark:border-red-900 font-mono">${safe}</pre>`;
      });

    return () => {
      cancelled = true;
    };
  }, [text, reactId, isDark]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shadow-inner dark:border-slate-700 dark:bg-slate-900/50">
      <TransformWrapper
        key={`${isDark ? 'd' : 'l'}-${text || 'empty'}`}
        initialScale={1}
        minScale={0.12}
        maxScale={8}
        limitToBounds={false}
        centerOnInit
        /* smooth wheel zoom multiplies step × |deltaY| — huge jumps on trackpads */
        smooth={false}
        wheel={{ step: 0.055 }}
        panning={{ allowLeftClickPan: true, velocityDisabled: false }}
        pinch={{ step: 5, disabled: false }}
        doubleClick={{ disabled: true }}
      >
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 shrink-0 dark:border-slate-700 dark:bg-slate-900">
            <p className="pl-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Pan:</span> drag ·{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">Zoom:</span> scroll or pinch
            </p>
            <DiagramZoomToolbar />
          </div>
          <TransformComponent
            wrapperClass="!w-full min-h-[min(70vh,560px)] max-h-[80vh] cursor-grab active:cursor-grabbing select-none touch-none bg-slate-100/80 dark:bg-slate-950/80"
            contentClass="!flex justify-center items-center p-10"
          >
            <div
              ref={containerRef}
              className="mermaid-host inline-block [&_svg]:block [&_svg]:max-w-none [&_svg]:h-auto"
            />
          </TransformComponent>
        </div>
      </TransformWrapper>
    </div>
  );
}
