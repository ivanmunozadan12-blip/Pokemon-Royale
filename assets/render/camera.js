import { CONFIG } from "../config.js";
const F = CONFIG.field;
/**
 * Cámara en perspectiva del campo (plano del suelo visto desde delante y algo elevado, como en los juegos de cartas móviles).
 *
 * Es una proyección real de un plano: las líneas rectas del campo siguen siendo rectas, las horizontales se mantienen
 * horizontales y el campo se estrecha hacia el fondo (`topScale`). Todo el dibujo y todos los toques pasan por aquí,
 * de modo que la lógica de combate sigue trabajando en casillas planas y no sabe nada de la perspectiva.
 *
 *   escala(y)  s = 1 / (1 + c·(1 − y/H))        s = 1 en la línea de fondo del jugador, `topScale` en la del rival
 *   pantalla   sx = cx + (x − W/2)·tile·s       sy = baseY − K·(1 − s)
 */
export class Camera {
    /** Tamaño CSS del lienzo y densidad de píxeles. */
    W = 360;
    H = 640;
    dpr = 1;
    /** Gira la perspectiva 180° para que el jugador del equipo 1 también vea su lado abajo. */
    flip = false;
    /** Ancho del campo en la línea inferior (px CSS) y alto total del campo en pantalla. */
    fw = 300;
    fh = 468;
    /** Centro horizontal del campo y píxel de su borde inferior. */
    cx = 180;
    baseY = 600;
    /** Píxeles por casilla en la línea inferior. */
    tile = 300 / F.w;
    /** Estrechamiento del fondo (1 = sin perspectiva). */
    topScale = 0.9;
    /** Relación alto/ancho que ocupa el campo en pantalla. */
    ratio = 1.56;
    c = 1 / 0.9 - 1;
    K = 1;
    /**
     * Coloca el campo ENTERO (nunca recortado) en la zona libre: desde `topInset` hasta `bottomY` (donde empieza el panel de cartas).
     * Si sobra altura, el campo queda pegado abajo y sobra decorado arriba; si sobra anchura, queda centrado con decorado a los lados.
     */
    layout(W, H, dpr, topInset, bottomY, sideInset = 0) {
        this.W = W;
        this.H = H;
        this.dpr = dpr;
        const availH = Math.max(120, bottomY - topInset);
        const availW = Math.max(120, W - sideInset * 2);
        this.fw = Math.floor(Math.min(availW, availH / this.ratio));
        this.fh = Math.floor(this.fw * this.ratio);
        this.cx = W / 2;
        this.baseY = bottomY;
        this.tile = this.fw / F.w;
        this.c = 1 / this.topScale - 1;
        this.K = this.fh / (1 - this.topScale);
    }
    /** Escala de perspectiva en la fila y (casillas). */
    s(y) {
        const yy = this.flip ? F.h - y : y;
        return 1 / (1 + this.c * (1 - yy / F.h));
    }
    /** Píxeles CSS por casilla en la fila y. */
    ts(y) {
        return this.tile * this.s(y);
    }
    sx(x, y) {
        const xx = this.flip ? F.w - x : x;
        return this.cx + (xx - F.w / 2) * this.tile * this.s(y);
    }
    sy(y) {
        return this.baseY - this.K * (1 - this.s(y));
    }
    /** Pantalla -> campo (casillas). Inversa exacta de sx/sy. */
    inv(px, py) {
        const s = Math.max(0.2, Math.min(3, 1 - (this.baseY - py) / this.K));
        const t = 1 - (1 / s - 1) / this.c;
        const x = F.w / 2 + (px - this.cx) / (this.tile * s);
        const y = t * F.h;
        return this.flip ? { x: F.w - x, y: F.h - y } : { x, y };
    }
    /** Razón entre los píxeles verticales y horizontales de una casilla del suelo en la fila y (achatamiento de la perspectiva). */
    vr(y) {
        return (this.K * this.c * this.s(y)) / (F.h * this.tile);
    }
    /** Borde superior del campo en pantalla. */
    get topY() {
        return this.baseY - this.fh;
    }
    /** Mitad del ancho del campo en la fila y (px). */
    halfW(y) {
        return (this.fw / 2) * this.s(y);
    }
}
