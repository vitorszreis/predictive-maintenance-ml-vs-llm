const pptxgen = require('pptxgenjs');
const React = require('react');
const RDS = require('react-dom/server');
const sharp = require('sharp');
const fa = require('react-icons/fa');
const path = require('path');
const { imageSize } = (() => { try { return require('image-size'); } catch (e) { return {}; } })();
const { applyTheme } = require(process.env.SKILL + '/scripts/apply_theme.js');
const fs = require('fs');

const FIG = path.join(__dirname, 'fig');
const THEME = {
  name: 'Manutencao Preditiva',
  headFontFace: 'Cambria', bodyFontFace: 'Calibri',
  colors: { dk1: '1E2A35', lt1: 'FFFFFF', dk2: '3E4A56', lt2: 'F3F5F7',
    accent1: '13807A', accent2: 'E07A2E', accent3: '6B3FA0', accent4: 'E8B020', accent5: '8A949E', accent6: 'C0392B',
    hlink: '13807A', folHlink: '6B3FA0' },
};
const H = { INK: '1E2A35', INK2: '3E4A56', TEAL: '13807A', TEAL_L: 'D9EFEC', OR: 'E07A2E', OR_L: 'FBE7D6',
  PU: '6B3FA0', PU2: '9B7BC8', PU_L: 'EFE8F8', GOLD: 'E8B020', GRAY: '8A949E', GRAY_T: '5F6B76', LIGHT: 'F3F5F7', RED: 'C0392B', WHITE: 'FFFFFF', LINE: 'D5DBE1' };

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = 'Manutenção preditiva: modelos clássicos x LLM';
pres.author = 'Vitor Reis';
const C = pres.SchemeColor;

const FOOT = 'Vitor Reis · DCC068 Redes Neurais Artificiais · UFJF';
pres.defineSlideMaster({ title: 'CONTEUDO', background: { color: 'FFFFFF' },
  objects: [{ text: { text: FOOT, options: { x: 0.6, y: 7.05, w: 8, h: 0.3, fontSize: 10, color: '8A949E', isTextBox: true, margin: 0 } } }],
  slideNumber: { x: 12.3, y: 7.05, w: 0.5, h: 0.3, fontSize: 10, color: '8A949E', align: 'right' },
});
pres.defineSlideMaster({ title: 'EXTRA', background: { color: 'FBF9FE' },
  objects: [{ text: { text: FOOT + '  ·  EXTRA (fora da comparação do enunciado)', options: { x: 0.6, y: 7.05, w: 9, h: 0.3, fontSize: 10, color: '9B7BC8', isTextBox: true, margin: 0 } } }],
  slideNumber: { x: 12.3, y: 7.05, w: 0.5, h: 0.3, fontSize: 10, color: '9B7BC8', align: 'right' },
});
pres.defineSlideMaster({ title: 'ESCURO', background: { color: '1E2A35' } });
pres.defineSlideMaster({ title: 'ESCURO_EXTRA', background: { color: '2D1B4A' } });

// ---------- helpers ----------
async function icon(Comp, color = 'FFFFFF', size = 256) {
  const svg = RDS.renderToStaticMarkup(React.createElement(Comp, { color: '#' + color, size }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + buf.toString('base64');
}
function dims(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function fitImage(slide, file, x, y, w, h, opts = {}) {
  const d = dims(file); const r = d.w / d.h;
  let iw = w, ih = w / r; if (ih > h) { ih = h; iw = h * r; }
  const ix = opts.alignLeft ? x : x + (w - iw) / 2; const iy = opts.alignTop ? y : y + (h - ih) / 2;
  slide.addImage({ path: file, x: ix, y: iy, w: iw, h: ih, altText: opts.alt || path.basename(file), objectName: opts.name });
  return { x: ix, y: iy, w: iw, h: ih };
}
const STEPS = ['Problema', 'Dados', 'Etapa I', 'Etapa II', 'Comparação'];
function crumb(slide, idx) {
  const w = 1.25, g = 0.06, x0 = 13.33 - 0.6 - (STEPS.length * w + (STEPS.length - 1) * g);
  STEPS.forEach((s, i) => {
    const active = i === idx, done = i < idx;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x0 + i * (w + g), y: 0.28, w, h: 0.3, rectRadius: 0.15,
      fill: { color: active ? H.TEAL : done ? H.TEAL_L : H.LIGHT }, line: { color: active ? H.TEAL : done ? H.TEAL_L : H.LIGHT }, objectName: 'etapa-' + i });
    slide.addText(`${i + 1}  ${s}`, { x: x0 + i * (w + g), y: 0.28, w, h: 0.3, fontSize: 10, bold: active, align: 'center', valign: 'middle',
      color: active ? H.WHITE : done ? H.TEAL : '9AA4AE', margin: 0, isTextBox: true });
  });
}
function crumbExtra(slide, label) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 13.33 - 0.6 - 3.6, y: 0.28, w: 3.6, h: 0.3, rectRadius: 0.15, fill: { color: H.PU }, line: { color: H.PU } });
  slide.addText([{ text: '★ EXTRA', options: { bold: true, color: H.GOLD } }, { text: '  ·  ' + label, options: { color: H.WHITE } }],
    { x: 13.33 - 0.6 - 3.6, y: 0.28, w: 3.6, h: 0.3, fontSize: 10, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
}
function title(slide, t, color = H.INK) {
  slide.addText(t, { x: 0.6, y: 0.62, w: 12.1, h: 0.75, fontFace: 'Cambria', fontSize: 30, bold: true, color, margin: 0, valign: 'middle', isTextBox: true });
}
function sub(slide, t, color = H.GRAY_T) {
  slide.addText(t, { x: 0.6, y: 1.33, w: 12.1, h: 0.4, fontSize: 15, italic: true, color, margin: 0, isTextBox: true });
}
function card(slide, x, y, w, h, fill, opts = {}) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: opts.line || fill, width: opts.lw || 0.75 },
    shadow: opts.shadow ? { type: 'outer', color: '000000', opacity: 0.12, blur: 6, offset: 2, angle: 90 } : undefined, objectName: opts.name });
}
function stat(slide, x, y, w, big, label, color, bigSize = 40) {
  slide.addText(big, { x, y, w, h: 0.75, fontFace: 'Cambria', fontSize: bigSize, bold: true, color, margin: 0, isTextBox: true, valign: 'bottom' });
  slide.addText(label, { x, y: y + 0.8, w, h: 0.7, fontSize: 13, color: H.INK2, margin: 0, isTextBox: true, valign: 'top' });
}
function bullets(slide, items, x, y, w, h, fs = 15, color = H.INK) {
  slide.addText(items.map((t, i) => {
    const runs = Array.isArray(t) ? t : [{ text: t }];
    return runs.map((r, j) => ({ text: r.text, options: Object.assign({ bullet: j === 0 ? { indent: 15 } : undefined, breakLine: j === runs.length - 1 && i < items.length - 1, paraSpaceAfter: 6, color }, r.options || {}) }));
  }).flat(), { x, y, w, h, fontSize: fs, margin: 0, valign: 'top', isTextBox: true });
}
const AX = { catAxisLabelColor: '4A5560', valAxisLabelColor: '4A5560', catAxisLabelFontFace: '+mn-lt', valAxisLabelFontFace: '+mn-lt',
  catAxisLabelFontSize: 11, valAxisLabelFontSize: 10, dataLabelFontFace: '+mn-lt', dataLabelFontSize: 10, dataLabelColor: '3E4A56',
  titleFontFace: '+mn-lt', titleFontSize: 12, titleColor: '3E4A56', legendFontFace: '+mn-lt', legendFontSize: 11, legendColor: '3E4A56',
  valGridLine: { color: 'E3E7EB', size: 0.5 }, catGridLine: { style: 'none' } };
const ax = (o) => Object.assign({}, JSON.parse(JSON.stringify(AX)), o);
function tableStyle(rows, header, colW, opts = {}) {
  const hdrFill = opts.hdr || H.TEAL;
  const body = rows.map((r, ri) => r.map((c) => {
    const cell = typeof c === 'object' && c !== null && c.text !== undefined ? c : { text: String(c) };
    cell.options = Object.assign({ fontSize: opts.fs || 12, color: H.INK, fill: { color: ri % 2 ? 'F7F9FA' : 'FFFFFF' }, valign: 'middle', margin: [2, 5, 2, 5] }, cell.options || {});
    return cell;
  }));
  const head = header.map((h) => ({ text: h, options: { bold: true, color: H.WHITE, fill: { color: hdrFill }, fontSize: opts.fs || 12, valign: 'middle', margin: [3, 5, 3, 5] } }));
  return [head, ...body];
}
function arrow(slide, x1, y1, x2, y2, color = H.GRAY, w = 1.5) {
  slide.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 0.001, h: Math.abs(y2 - y1) || 0.001,
    flipH: x2 < x1, flipV: y2 < y1, line: { color, width: w, endArrowType: 'triangle' } });
}
function box(slide, x, y, w, h, fill, text, opts = {}) {
  card(slide, x, y, w, h, fill, { line: opts.line, shadow: opts.shadow, lw: opts.lw });
  slide.addText(text, { x, y, w, h, fontSize: opts.fs || 12, color: opts.color || H.INK, bold: opts.bold, align: opts.align || 'center', valign: 'middle', margin: 4, isTextBox: true });
}
const f = (v, d = 2) => v.toFixed(d).replace('.', ',');

(async () => {
  const IC = {
    factory: await icon(fa.FaIndustry), db: await icon(fa.FaDatabase), cogs: await icon(fa.FaCogs), robot: await icon(fa.FaRobot),
    scale: await icon(fa.FaBalanceScale), star: await icon(fa.FaStar, H.GOLD), warn: await icon(fa.FaExclamationTriangle),
    clock: await icon(fa.FaClock), dollar: await icon(fa.FaDollarSign), brain: await icon(fa.FaBrain), ruler: await icon(fa.FaRulerCombined),
    search: await icon(fa.FaSearch), book: await icon(fa.FaBook), code: await icon(fa.FaCode), target: await icon(fa.FaBullseye),
    sliders: await icon(fa.FaSlidersH), flask: await icon(fa.FaFlask), check: await icon(fa.FaCheck), layers: await icon(fa.FaLayerGroup),
    calc: await icon(fa.FaCalculator), users: await icon(fa.FaUserFriends), bolt: await icon(fa.FaBolt), lock: await icon(fa.FaLock),
  };
  const iconCircle = (slide, ic, x, y, d, fill) => {
    slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill } });
    slide.addImage({ data: ic, x: x + d * 0.25, y: y + d * 0.25, w: d * 0.5, h: d * 0.5, altText: 'ícone' });
  };

  // ===== 1. Capa =====
  pres.addSection({ title: 'Abertura' });
  let s = pres.addSlide({ masterName: 'ESCURO', sectionTitle: 'Abertura' });
  iconCircle(s, IC.factory, 0.8, 1.2, 0.9, H.OR);
  s.addText('Manutenção preditiva:\nmodelos clássicos x LLM', { x: 0.8, y: 2.35, w: 8.2, h: 1.8, fontFace: 'Cambria', fontSize: 44, bold: true, color: H.WHITE, margin: 0, isTextBox: true, valign: 'top' });
  s.addText('Prever falhas de uma fresadora com SVM, MLP, Random Forest e XGBoost e comparar com o DeepSeek consultado só por prompt',
    { x: 0.8, y: 4.3, w: 7.6, h: 0.9, fontSize: 18, color: 'C9D3DC', margin: 0, isTextBox: true });
  s.addText('Vitor Reis  ·  DCC068 Redes Neurais Artificiais  ·  UFJF  ·  Dezembro de 2026', { x: 0.8, y: 6.3, w: 8, h: 0.4, fontSize: 14, color: '9FB0BF', margin: 0, isTextBox: true });
  // painel direito: 3 números
  [['10.000', 'ciclos de operação (AI4I 2020)', H.WHITE], ['0,88', 'melhor F1 clássico (MLP / XGBoost)', '5FD3C6'], ['0,66', 'melhor F1 do LLM no enunciado', 'F4A261']].forEach((r, i) => {
    card(s, 9.4, 1.2 + i * 1.75, 3.3, 1.5, '28394A');
    s.addText(r[0], { x: 9.65, y: 1.3 + i * 1.75, w: 2.9, h: 0.75, fontFace: 'Cambria', fontSize: 36, bold: true, color: r[2], margin: 0, isTextBox: true });
    s.addText(r[1], { x: 9.65, y: 2.05 + i * 1.75, w: 2.9, h: 0.5, fontSize: 13, color: 'C9D3DC', margin: 0, isTextBox: true });
  });
  s.addNotes('Tema: prever falhas de máquinas industriais e medir se um LLM consultado só por prompt compete com modelos clássicos treinados na mesma base. No final há uma seção EXTRA, fora do que o enunciado pede.');

  // ===== 2. Roteiro / encadeamento =====
  s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Abertura' });
  title(s, 'O fio do estudo');
  sub(s, 'Cada etapa responde uma pergunta e entrega o insumo da seguinte');
  const flow = [
    [IC.target, 'Problema', 'A máquina vai falhar neste ciclo?', 'classificação binária, 3,4% de falhas'],
    [IC.db, 'Dados', 'O que entra no modelo?', 'AI4I 2020, 6 atributos, sem vazamento'],
    [IC.cogs, 'Etapa I', 'Quanto acertam modelos treinados?', 'SVM, MLP, RF, XGBoost'],
    [IC.robot, 'Etapa II', 'E um LLM só com prompt?', 'DeepSeek, zero-shot e k = 3, 5, 10, 20'],
    [IC.scale, 'Comparação', 'Quem vence, e a que custo?', 'mesmos 200 casos, F1, tempo, custo'],
  ];
  flow.forEach((st, i) => {
    const x = 0.6 + i * 2.38;
    card(s, x, 2.15, 2.1, 3.2, i % 2 ? 'F7F9FA' : H.LIGHT);
    iconCircle(s, st[0], x + 0.7, 2.35, 0.7, i === 3 ? H.OR : H.TEAL);
    s.addText(`${i + 1}. ${st[1]}`, { x: x + 0.1, y: 3.15, w: 1.9, h: 0.4, fontSize: 16, bold: true, align: 'center', color: H.INK, margin: 0, isTextBox: true });
    s.addText(st[2], { x: x + 0.12, y: 3.6, w: 1.86, h: 0.8, fontSize: 13, italic: true, align: 'center', color: H.TEAL, margin: 0, isTextBox: true });
    s.addText(st[3], { x: x + 0.12, y: 4.4, w: 1.86, h: 0.8, fontSize: 12, align: 'center', color: H.INK2, margin: 0, isTextBox: true });
    if (i < 4) arrow(s, x + 2.12, 3.75, x + 2.36, 3.75, H.GRAY, 2);
  });
  // extra separado
  s.addShape(pres.shapes.LINE, { x: 0.6, y: 5.65, w: 12.1, h: 0, line: { color: H.PU2, width: 1, dashType: 'dash' } });
  card(s, 0.6, 5.85, 12.1, 0.95, H.PU_L);
  iconCircle(s, IC.star, 0.8, 5.98, 0.68, H.PU);
  s.addText([{ text: 'EXTRA, à parte:  ', options: { bold: true, color: H.PU } },
    { text: 'e se o LLM recebesse conhecimento de domínio (regras de falha, grandezas derivadas, vizinhos parecidos)? Resultado separado, fora da comparação justa.', options: { color: H.INK } }],
  { x: 1.65, y: 5.85, w: 10.9, h: 0.95, fontSize: 14, valign: 'middle', margin: 0, isTextBox: true });
  s.addNotes('Mostrar o encadeamento: problema, dados, Etapa I, Etapa II e comparação. O selo no topo de cada slide indica em que etapa estamos. O experimento extra fica numa seção própria, roxa, porque muda as regras do jogo.');

  // ===== 3. Problema =====
  pres.addSection({ title: 'Problema e dados' });
  s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Problema e dados' });
  crumb(s, 0); title(s, 'O problema: prever a falha antes da parada');
  card(s, 0.6, 1.65, 6.2, 5.1, H.LIGHT);
  s.addText([
    { text: 'Uma parada não planejada interrompe a linha e custa caro.', options: { breakLine: true } },
    { text: ' ', options: { breakLine: true, fontSize: 8 } },
    { text: 'Pergunta do trabalho', options: { bold: true, color: H.TEAL, breakLine: true } },
    { text: 'Dadas as leituras de sensores de um ciclo de operação, a máquina vai falhar?', options: { italic: true, breakLine: true } },
    { text: ' ', options: { breakLine: true, fontSize: 8 } },
    { text: 'Por que é difícil', options: { bold: true, color: H.TEAL, breakLine: true } },
    { text: 'Classe rara: só 3,4% dos ciclos falham.', options: { bullet: { indent: 15 }, breakLine: true } },
    { text: 'Deixar passar uma falha (FN) custa mais que um alarme falso (FP).', options: { bullet: { indent: 15 }, breakLine: true } },
    { text: 'Acurácia engana; a métrica principal é o F1 da classe falha.', options: { bullet: { indent: 15 } } },
  ], { x: 0.9, y: 1.9, w: 5.7, h: 4.6, fontSize: 16, color: H.INK, margin: 0, valign: 'top', isTextBox: true });
  card(s, 7.2, 1.65, 2.6, 2.4, H.OR_L); stat(s, 7.45, 1.8, 2.2, '3,4%', '339 falhas em 10.000 ciclos', H.OR, 44);
  card(s, 10.1, 1.65, 2.6, 2.4, H.TEAL_L); stat(s, 10.35, 1.8, 2.2, '96,6%', 'acurácia de quem responde sempre "normal"', H.TEAL, 44);
  s.addChart(pres.charts.DOUGHNUT, [{ name: 'Classe', labels: ['Normal', 'Falha'], values: [9661, 339] }], ax({ x: 7.2, y: 4.25, w: 5.5, h: 2.5,
    chartColors: ['C9D3DC', H.OR], holeSize: 62, showLegend: true, legendPos: 'r', showPercent: true, showValue: false, dataLabelColor: H.INK, dataLabelFontSize: 11,
    showTitle: true, title: 'Distribuição do alvo Machine failure' }));
  s.addNotes('Um classificador trivial acerta 96,6% e não detecta nada. Por isso o foco é revocação, precisão e F1 da classe falha.');

  // ===== 4. Base =====
  s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Problema e dados' });
  crumb(s, 1); title(s, 'A base AI4I 2020 (UCI)');
  [['10.000', 'ciclos de uma fresadora'], ['6', 'atributos de entrada'], ['339', 'falhas (alvo = 1)'], ['5', 'modos de falha rotulados']].forEach((r, i) => {
    card(s, 0.6 + i * 3.08, 1.6, 2.86, 1.15, i === 2 ? H.OR_L : H.LIGHT);
    s.addText(r[0], { x: 0.8 + i * 3.08, y: 1.65, w: 1.45, h: 1.05, fontFace: 'Cambria', fontSize: 30, bold: true, color: i === 2 ? H.OR : H.TEAL, margin: 0, valign: 'middle', isTextBox: true });
    s.addText(r[1], { x: 2.3 + i * 3.08, y: 1.65, w: 1.1, h: 1.05, fontSize: 13, color: H.INK2, margin: 0, valign: 'middle', isTextBox: true });
  });
  s.addTable(tableStyle([
    ['M', '298,1', '308,6', '1551', '42,8', '0', '0'],
    ['L', '298,2', '308,7', '1408', '46,3', '3', '0'],
    ['L', '298,9', '309,1', '2861', { text: '4,6', options: { bold: true, color: H.OR } }, '143', { text: '1', options: { bold: true, color: H.OR } }],
  ], ['Tipo', 'T. ar [K]', 'T. processo [K]', 'Rotação [rpm]', 'Torque [Nm]', 'Desgaste [min]', 'Falha'], null, { fs: 13 }),
  { x: 0.6, y: 3.05, w: 7.6, colW: [0.7, 1.0, 1.35, 1.25, 1.15, 1.35, 0.8], rowH: 0.38 });
  s.addText('Linhas reais da base (UDI 1, 2 e 51). A terceira é uma falha de potência: rotação alta com torque muito baixo. Tipo = qualidade do produto (L 60%, M 30%, H 10%).',
    { x: 0.6, y: 4.75, w: 7.6, h: 0.75, fontSize: 13, color: H.GRAY_T, margin: 0, isTextBox: true });
  card(s, 0.6, 5.6, 7.6, 1.2, H.LIGHT);
  s.addText([{ text: 'Base sintética ', options: { bold: true } }, { text: 'de Matzka (2020), gerada por regras físicas de limiar. Sem nulos nem duplicados. Isso vai pesar nas conclusões e no EXTRA.' }],
    { x: 0.8, y: 5.6, w: 7.2, h: 1.2, fontSize: 14, color: H.INK, margin: 0, valign: 'middle', isTextBox: true });
  fitImage(s, path.join(FIG, 'eda_target.png'), 8.6, 3.0, 4.1, 3.8, { alt: 'Gráfico de barras: contagem de ciclos normais e de falhas' });
  s.addText('notebooks/01_eda_preparacao.ipynb', { x: 8.6, y: 6.72, w: 4.1, h: 0.25, fontSize: 10, italic: true, color: H.GRAY, align: 'center', margin: 0, isTextBox: true });
  s.addNotes('Atributos: tipo do produto, temperaturas do ar e do processo, rotação, torque e desgaste da ferramenta. Alvo: Machine failure.');

  // ===== 5. EDA distribuições =====
  s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Problema e dados' });
  crumb(s, 1); title(s, 'O que separa uma falha de um ciclo normal');
  const ed = fitImage(s, path.join(FIG, 'eda_distribuicoes.png'), 0.6, 1.6, 8.6, 5.2, { alt: 'Histogramas dos atributos por classe' });
  card(s, 9.5, 1.6, 3.2, 5.2, H.LIGHT);
  s.addText('Leitura dos histogramas', { x: 9.7, y: 1.75, w: 2.9, h: 0.4, fontSize: 15, bold: true, color: H.TEAL, margin: 0, isTextBox: true });
  bullets(s, [
    'Falhas se concentram em torque alto e em rotação baixa ou muito alta.',
    'Desgaste acima de ~200 min aumenta o risco.',
    'Temperaturas sozinhas pouco separam; o que importa é a diferença entre elas.',
    'Nenhum atributo isolado resolve: as fronteiras combinam grandezas.',
  ], 9.7, 2.25, 2.85, 4.4, 14);
  s.addNotes('Figura gerada no notebook 01. Esses padrões explicam por que árvores e MLP vão bem: a base é gerada por limiares sobre combinações de grandezas.');

  // ===== 6. Correlação + modos + vazamento =====
  s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Problema e dados' });
  crumb(s, 1); title(s, 'Modos de falha, correlações e o risco de vazamento');
  s.addChart(pres.charts.BAR, [{ name: 'Casos', labels: ['Dissipação de calor (HDF)', 'Sobrecarga (OSF)', 'Potência (PWF)', 'Desgaste (TWF)', 'Aleatória (RNF)'], values: [115, 98, 95, 46, 19] }],
    ax({ x: 0.5, y: 1.55, w: 4.6, h: 3.4, barDir: 'bar', chartColors: [H.OR], showValue: true, dataLabelPosition: 'outEnd', showLegend: false, catAxisOrientation: 'maxMin',
      valAxisHidden: true, valGridLine: { style: 'none' }, showTitle: true, title: 'Casos por modo de falha' }));
  fitImage(s, path.join(FIG, 'eda_correlacao.png'), 5.3, 1.55, 4.0, 3.4, { alt: 'Matriz de correlação' });
  s.addText('Correlação: torque e rotação (−0,88); as temperaturas (0,88)', { x: 5.3, y: 4.95, w: 4.0, h: 0.4, fontSize: 11, italic: true, color: H.GRAY_T, align: 'center', margin: 0, isTextBox: true });
  card(s, 9.6, 1.55, 3.1, 3.8, H.OR_L);
  iconCircle(s, IC.warn, 9.8, 1.75, 0.6, H.OR);
  s.addText('Colunas removidas', { x: 10.5, y: 1.8, w: 2.1, h: 0.5, fontSize: 15, bold: true, color: H.INK, margin: 0, isTextBox: true, valign: 'middle' });
  s.addText('TWF, HDF, PWF, OSF e RNF dizem qual falha ocorreu. Como entrada, entregariam a resposta (data leakage). UDI e Product ID também saem.',
    { x: 9.8, y: 2.45, w: 2.75, h: 2.7, fontSize: 13, color: H.INK, margin: 0, valign: 'top', isTextBox: true });
  card(s, 0.6, 5.55, 12.1, 1.25, H.LIGHT);
  s.addText([{ text: 'Ruído conhecido mantido: ', options: { bold: true } }, { text: '9 falhas sem modo marcado e 18 ciclos com modo marcado mas sem falha. ' },
    { text: 'Atributos derivados (ΔT, potência, desgaste × torque) ficam de fora no estudo principal, ', options: { bold: true } }, { text: 'para clássicos e LLM receberem as mesmas 6 grandezas brutas.' }],
  { x: 0.85, y: 5.55, w: 11.7, h: 1.25, fontSize: 14, color: H.INK, margin: 0, valign: 'middle', isTextBox: true });
  s.addNotes('Vazamento: se o modelo vê a coluna HDF, aprende que HDF=1 implica falha. Os modos ficam só para analisar erros. Os derivados aparecem num experimento complementar da Etapa I e no EXTRA.');

  // ===== 7. Pipeline diagram =====
  s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Problema e dados' });
  crumb(s, 1); title(s, 'Pipeline experimental sem vazamento');
  box(s, 0.6, 3.35, 1.7, 1.0, H.INK, 'ai4i2020.csv\n10.000 ciclos', { color: H.WHITE, bold: true, fs: 12 });
  arrow(s, 2.3, 3.85, 2.65, 3.85);
  box(s, 2.65, 3.25, 1.9, 1.2, H.LIGHT, 'Limpeza\nremove ids e modos\none-hot do Tipo', { fs: 12 });
  arrow(s, 4.55, 3.85, 4.9, 3.85);
  box(s, 4.9, 3.25, 1.6, 1.2, H.LIGHT, 'Divisão\n80/20 estratificada\nsemente 42', { fs: 12 });
  // treino ramo
  arrow(s, 6.5, 3.6, 7.0, 2.35); arrow(s, 6.5, 4.1, 7.0, 5.3);
  box(s, 7.0, 1.6, 1.9, 1.4, H.TEAL_L, 'Treino\n8.000 ciclos\n271 falhas', { fs: 12, bold: true, color: H.TEAL });
  arrow(s, 8.9, 2.3, 9.3, 2.3, H.TEAL);
  box(s, 9.3, 1.6, 3.4, 1.4, H.TEAL, 'Etapa I: pipeline por fold\nz-score → SMOTE → modelo\nGridSearchCV 5 folds (F1)', { color: H.WHITE, fs: 12 });
  box(s, 7.0, 4.6, 1.9, 1.4, H.LIGHT, 'Teste\n2.000 ciclos\n68 falhas', { fs: 12, bold: true });
  arrow(s, 8.9, 5.3, 9.3, 5.3);
  box(s, 9.3, 4.6, 3.4, 1.4, H.OR_L, 'Amostra fixa: 200 casos\n50 falhas + 150 normais\navaliada por TODOS', { fs: 12, bold: true, color: 'A4521A' });
  // few-shot from train to LLM
  box(s, 9.3, 3.25, 3.4, 1.0, H.OR, 'Etapa II: DeepSeek\nexemplos few-shot vêm do treino', { color: H.WHITE, fs: 12 });
  arrow(s, 8.9, 2.75, 9.3, 3.55, H.OR);
  arrow(s, 11.0, 4.25, 11.0, 4.6, H.OR);
  s.addText([{ text: 'Por que a amostra fixa? ', options: { bold: true, color: H.TEAL } },
    { text: 'chamar o LLM nos 2.000 casos em 5 configurações seria lento e caro; uma subamostra natural teria só ~7 falhas. Com 50 falhas a revocação é medível, e clássicos e LLM veem exatamente os mesmos casos.' }],
  { x: 0.6, y: 6.15, w: 12.1, h: 0.75, fontSize: 13, color: H.INK, margin: 0, isTextBox: true, valign: 'middle' });
  s.addText('O teste nunca participa de decisões de modelagem', { x: 0.6, y: 1.75, w: 5.9, h: 0.5, fontSize: 15, italic: true, color: H.GRAY_T, margin: 0, isTextBox: true });
  s.addNotes('Normalização e SMOTE estão dentro do pipeline: média, desvio e falhas sintéticas são calculados só no treino de cada fold. Os clássicos também são avaliados no teste completo, para mostrar o efeito do enriquecimento da amostra.');

  // ===== 8. Métricas =====
  s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Problema e dados' });
  crumb(s, 1); title(s, 'Como medimos');
  bullets(s, [
    [{ text: 'Métricas do enunciado: ', options: { bold: true } }, { text: 'acurácia, precisão, revocação, F1, AUC-ROC e matriz de confusão.' }],
    [{ text: 'Revocação: ', options: { bold: true, color: H.TEAL } }, { text: 'das falhas reais, quantas o modelo pegou.' }],
    [{ text: 'Precisão: ', options: { bold: true, color: H.TEAL } }, { text: 'dos alarmes, quantos eram falha de verdade.' }],
    [{ text: 'F1: ', options: { bold: true, color: H.TEAL } }, { text: 'média harmônica das duas. Métrica principal, também usada no GridSearch.' }],
    [{ text: 'Etapa II: ', options: { bold: true, color: H.OR } }, { text: 'mais tempo por 100 amostras, tokens e custo da API.' }],
  ], 0.6, 1.75, 6.0, 4.8, 16);
  const mx = 7.4, my = 2.1;
  s.addText('Previsto', { x: mx + 1.2, y: my - 0.45, w: 4.0, h: 0.35, fontSize: 13, bold: true, color: H.GRAY_T, align: 'center', margin: 0, isTextBox: true });
  s.addText('Normal', { x: mx + 1.2, y: my - 0.1, w: 2.0, h: 0.3, fontSize: 12, color: H.GRAY_T, align: 'center', margin: 0, isTextBox: true });
  s.addText('Falha', { x: mx + 3.2, y: my - 0.1, w: 2.0, h: 0.3, fontSize: 12, color: H.GRAY_T, align: 'center', margin: 0, isTextBox: true });
  s.addText('Normal', { x: mx, y: my + 0.3, w: 1.1, h: 1.9, fontSize: 12, color: H.GRAY_T, align: 'right', valign: 'middle', margin: 0, isTextBox: true });
  s.addText('Falha', { x: mx, y: my + 2.3, w: 1.1, h: 1.9, fontSize: 12, color: H.GRAY_T, align: 'right', valign: 'middle', margin: 0, isTextBox: true });
  s.addText('Real', { x: mx - 0.55, y: my + 1.9, w: 0.5, h: 0.6, fontSize: 13, bold: true, color: H.GRAY_T, margin: 0, isTextBox: true, valign: 'middle' });
  [[0, 0, 'VN', 'acerto', H.LIGHT, H.INK], [1, 0, 'FP', 'alarme falso', H.OR_L, 'A4521A'], [0, 1, 'FN', 'falha perdida:\no erro mais caro', 'F6D5D1', H.RED], [1, 1, 'VP', 'falha detectada', H.TEAL_L, H.TEAL]].forEach((c) => {
    const x = mx + 1.2 + c[0] * 2.05, y = my + 0.3 + c[1] * 2.05;
    card(s, x, y, 1.95, 1.95, c[4]);
    s.addText(c[2], { x, y: y + 0.25, w: 1.95, h: 0.7, fontFace: 'Cambria', fontSize: 30, bold: true, color: c[5], align: 'center', margin: 0, isTextBox: true });
    s.addText(c[3], { x, y: y + 1.0, w: 1.95, h: 0.75, fontSize: 12, color: H.INK, align: 'center', margin: 0, isTextBox: true });
  });
  s.addNotes('O falso negativo é a falha que passa sem alarme; é o erro mais caro na indústria. Precisão = VP/(VP+FP); revocação = VP/(VP+FN).');

  // ===== 9. Etapa I hiperparâmetros =====
  pres.addSection({ title: 'Etapa I' });
  s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Etapa I' });
  crumb(s, 2); title(s, 'Etapa I: quatro modelos, busca em grade');
  s.addTable(tableStyle([
    [{ text: 'SVM (RBF)', options: { bold: true } }, 'C ∈ {0,1; 1; 10; 100}, γ ∈ {scale; 0,1; 0,01}', 'C = 100, γ = scale', '0,542', '186,8'],
    [{ text: 'MLP', options: { bold: true } }, 'camadas (16), (32), (32,16), (64,32); α; taxa', '(64, 32), α = 0,01, taxa 0,01', '0,594', '81,2'],
    [{ text: 'Random Forest', options: { bold: true } }, '200 ou 500 árvores; profundidade livre, 10, 20', '200 árvores, sem limite', '0,631', '18,5'],
    [{ text: 'XGBoost', options: { bold: true } }, '200/500 árvores; profundidade 3/6; taxa 0,05/0,1', '500, prof. 6, taxa 0,1', { text: '0,689', options: { bold: true, color: H.TEAL } }, '8,4'],
  ], ['Modelo', 'Grade testada', 'Melhor configuração', 'F1 (CV)', 'Busca [s]'], null, { fs: 13 }),
  { x: 0.6, y: 1.65, w: 8.3, colW: [1.5, 3.3, 2.1, 0.7, 0.7], rowH: 0.55 });
  s.addChart(pres.charts.BAR, [{ name: 'F1 (CV)', labels: ['SVM', 'MLP', 'RF', 'XGBoost'], values: [0.542, 0.594, 0.631, 0.689] }],
    ax({ x: 9.2, y: 1.55, w: 3.5, h: 3.2, barDir: 'col', chartColors: [H.TEAL], showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0.00', showLegend: false,
      valAxisMinVal: 0, valAxisMaxVal: 0.8, valAxisHidden: true, valGridLine: { style: 'none' }, showTitle: true, title: 'F1 médio na validação cruzada' }));
  card(s, 0.6, 4.95, 12.1, 1.85, H.LIGHT);
  iconCircle(s, IC.brain, 0.85, 5.35, 0.9, H.TEAL);
  s.addText([{ text: 'Ligação com a disciplina: ', options: { bold: true, color: H.TEAL } },
    { text: 'SVM com kernel RBF e MLP treinada por retropropagação (até 500 épocas, early stopping) são os modelos centrais; RF e XGBoost entram como referência forte em dados tabulares. Pipeline: z-score + one-hot → SMOTE → modelo, com 5 folds estratificados otimizando F1.' }],
  { x: 2.0, y: 4.95, w: 10.5, h: 1.85, fontSize: 14, color: H.INK, margin: 0, valign: 'middle', isTextBox: true });
  s.addNotes('O F1 da validação é menor que o da amostra fixa porque a validação usa a proporção natural de 3,4% de falhas.');

  // ===== 10. Etapa I resultados teste completo =====
  s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Etapa I' });
  crumb(s, 2); title(s, 'Etapa I: resultado no teste completo');
  sub(s, '2.000 ciclos, 68 falhas, proporção real');
  s.addChart(pres.charts.BAR, [
    { name: 'Precisão', labels: ['SVM', 'MLP', 'Random Forest', 'XGBoost'], values: [0.402, 0.509, 0.495, 0.714] },
    { name: 'Revocação', labels: ['SVM', 'MLP', 'Random Forest', 'XGBoost'], values: [0.779, 0.809, 0.735, 0.809] },
    { name: 'F1', labels: ['SVM', 'MLP', 'Random Forest', 'XGBoost'], values: [0.530, 0.625, 0.592, 0.759] },
  ], ax({ x: 0.5, y: 1.8, w: 7.6, h: 5.0, barDir: 'col', barGapWidthPct: 60, chartColors: ['A9B4BE', '7FC8BF', H.TEAL], showValue: true, dataLabelPosition: 'outEnd',
    dataLabelFormatCode: '0.00', dataLabelFontSize: 9, showLegend: true, legendPos: 'b', valAxisMinVal: 0, valAxisMaxVal: 1, valAxisLabelFormatCode: '0.0' }));
  card(s, 8.5, 1.8, 4.2, 1.9, H.TEAL_L);
  stat(s, 8.75, 1.85, 3.8, '0,76', 'F1 do XGBoost, o melhor, com só 22 alarmes falsos', H.TEAL, 44);
  bullets(s, ['Todos pegam de 74% a 81% das falhas.', 'MLP em segundo (F1 0,63, 53 alarmes falsos).', 'SVM é o mais alarmista (79 FP, F1 0,53).', 'AUC-ROC de 0,95 a 0,97 em todos: separam bem as classes.'],
    8.6, 4.0, 4.1, 2.8, 15);
  s.addNotes('Precisão baixa no teste completo é esperada com só 3,4% de falhas: poucos falsos positivos já derrubam a precisão. Árvores aproximam bem fronteiras de limiar, que é como a base foi gerada.');

  // ===== 11. ROC + CMs =====
  s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Etapa I' });
  crumb(s, 2); title(s, 'Curvas ROC e matrizes de confusão');
  fitImage(s, path.join(FIG, 'roc_classical.png'), 0.6, 1.55, 5.2, 5.25, { alt: 'Curvas ROC dos 4 modelos no teste completo' });
  const cms = [['svm', 'SVM'], ['mlp', 'MLP'], ['rf', 'Random Forest'], ['xgb', 'XGBoost']];
  cms.forEach((m, i) => {
    const x = 6.2 + (i % 2) * 3.3, y = 1.5 + Math.floor(i / 2) * 2.7;
    s.addText(m[1], { x, y, w: 3.1, h: 0.3, fontSize: 13, bold: true, color: m[0] === 'xgb' ? H.TEAL : H.INK, align: 'center', margin: 0, isTextBox: true });
    fitImage(s, path.join(FIG, `cm_${m[0]}_test_full.png`), x, y + 0.3, 3.1, 2.3, { alt: 'Matriz de confusão ' + m[1] });
  });
  s.addNotes('Gráficos gerados por src/train_classical.py. Todas as curvas ROC ficam próximas do canto superior esquerdo; a diferença entre modelos está nos alarmes falsos do limiar padrão.');

  // ===== 12. Complementares =====
  s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Etapa I' });
  crumb(s, 2); title(s, 'Etapa I: e se mudarmos o balanceamento ou os atributos?');
  sub(s, 'F1 no teste completo para três estratégias (experimentos complementares)');
  s.addChart(pres.charts.BAR, [
    { name: 'SMOTE (principal)', labels: ['SVM', 'MLP', 'Random Forest', 'XGBoost'], values: [0.530, 0.625, 0.592, 0.759] },
    { name: 'Pesos de classe', labels: ['SVM', 'MLP', 'Random Forest', 'XGBoost'], values: [0.493, 0.596, 0.692, 0.768] },
    { name: 'SMOTE + derivados', labels: ['SVM', 'MLP', 'Random Forest', 'XGBoost'], values: [0.559, 0.640, 0.718, 0.748] },
  ], ax({ x: 0.5, y: 1.85, w: 7.8, h: 4.95, barDir: 'col', barGapWidthPct: 60, chartColors: [H.TEAL, 'A9B4BE', H.GOLD], showValue: true, dataLabelPosition: 'outEnd',
    dataLabelFormatCode: '0.00', dataLabelFontSize: 9, showLegend: true, legendPos: 'b', valAxisMinVal: 0, valAxisMaxVal: 1, valAxisLabelFormatCode: '0.0' }));
  card(s, 8.7, 1.85, 4.0, 4.95, H.LIGHT);
  bullets(s, [
    [{ text: 'Derivados ajudam: ', options: { bold: true } }, { text: 'ΔT, potência e desgaste × torque sobem o RF de 0,59 para 0,72. As regras da base dependem dessas grandezas.' }],
    [{ text: 'Pesos de classe ', options: { bold: true } }, { text: 'favorecem as árvores (XGBoost 0,77).' }],
    [{ text: 'MLP sem balanceamento ', options: { bold: true } }, { text: 'fica conservadora: 5 FP, mas só 31 de 68 falhas.' }],
    [{ text: 'A conclusão não muda; ', options: { bold: true, color: H.TEAL } }, { text: 'a comparação com o LLM usa a configuração principal.' }],
  ], 8.95, 2.05, 3.55, 4.6, 14);
  s.addNotes('O MLPClassifier do scikit-learn não aceita pesos de classe, por isso na variação com pesos a MLP foi treinada sem balanceamento. Essa pista dos derivados é o que motiva o EXTRA.');

  // ===== 13. Etapa II setup =====
  pres.addSection({ title: 'Etapa II' });
  s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Etapa II' });
  crumb(s, 3); title(s, 'Etapa II: classificar só com um prompt');
  [[IC.robot, 'Modelo', 'deepseek-chat (API DeepSeek), alias de deepseek-v4-flash sem raciocínio estendido. Temperatura 0, até 200 tokens de saída.'],
    [IC.code, 'Entrada', 'A mesma leitura dos clássicos, em texto e com unidades físicas (sem normalizar). Prompt em português, versão v1.'],
    [IC.check, 'Saída', 'JSON {"falha", "probabilidade"}. A probabilidade permite calcular AUC-ROC. Nenhuma resposta inválida em 1.000 consultas.'],
  ].forEach((r, i) => {
    const y = 1.7 + i * 1.25;
    iconCircle(s, r[0], 0.6, y, 0.75, H.OR);
    s.addText(r[1], { x: 1.55, y, w: 5.0, h: 0.35, fontSize: 16, bold: true, color: H.INK, margin: 0, isTextBox: true });
    s.addText(r[2], { x: 1.55, y: y + 0.35, w: 5.0, h: 0.8, fontSize: 13, color: H.INK2, margin: 0, isTextBox: true, valign: 'top' });
  });
  // nested few-shot diagram
  s.addText('Exemplos few-shot aninhados (do treino, metade falhas)', { x: 7.0, y: 1.6, w: 5.7, h: 0.4, fontSize: 14, bold: true, color: H.INK, margin: 0, isTextBox: true });
  const nest = [[20, 'FBE7D6', 5.7, 3.7], [10, 'F6CFAE', 4.4, 2.85], [5, 'F1B483', 3.1, 2.0], [3, H.OR, 1.8, 1.15]];
  nest.forEach((n) => {
    const x = 7.0, y = 2.1 + (3.7 - n[3]);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: n[2], h: n[3], rectRadius: 0.12, fill: { color: n[1] }, line: { color: 'FFFFFF', width: 1.5 } });
    s.addText(`k = ${n[0]}`, { x: x + n[2] - 1.25, y: y + 0.08, w: 1.15, h: 0.35, fontSize: 14, bold: true, color: n[0] === 3 ? H.WHITE : 'A4521A', align: 'right', margin: 0, isTextBox: true });
  });
  s.addText('3 ⊂ 5 ⊂ 10 ⊂ 20: a diferença entre configurações vem só dos exemplos acrescentados, não de um novo sorteio.', { x: 7.0, y: 5.95, w: 5.7, h: 0.8, fontSize: 13, italic: true, color: H.GRAY_T, margin: 0, isTextBox: true });
  card(s, 0.6, 5.55, 6.0, 1.25, H.OR_L);
  s.addText([{ text: 'Configurações: ', options: { bold: true, color: 'A4521A' } }, { text: 'zero-shot e few-shot com k = 3, 5, 10 e 20, cada uma nos mesmos 200 casos. Consultas em 22/11/2026, uma por vez.' }],
    { x: 0.8, y: 5.55, w: 5.7, h: 1.25, fontSize: 13, color: H.INK, margin: 0, valign: 'middle', isTextBox: true });
  s.addNotes('O nome da base não aparece no prompt, para reduzir o risco de o modelo reconhecê-la de dados de treino. Os prompts completos ficam versionados em reports/results/prompts/.');

  // ===== 14. Print do prompt v1 =====
  s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Etapa II' });
  crumb(s, 3); title(s, 'O prompt real que o LLM recebe');
  const pr = fitImage(s, path.join(__dirname, 'prompt_v1_k3.png'), 0.6, 1.55, 9.0, 5.05, { alignLeft: true, alignTop: true, alt: 'Print do prompt v1 com 3 exemplos, gerado por src/llm/prompts.py' });
  const ann = [
    [H.OR, 'SYSTEM', 'Papel (engenheiro de manutenção), tarefa, significado de cada atributo e formato de saída obrigatório.'],
    [H.TEAL, 'USER: exemplos', 'k leituras do treino com o rótulo. No zero-shot a lista some.'],
    [H.INK2, 'USER: caso', 'A leitura a classificar, igual à dos clássicos, em unidades físicas.'],
    ['B8860B', 'JSON', 'Rótulo + probabilidade, que vira a pontuação da curva ROC.'],
  ];
  ann.forEach((a, i) => {
    const y = 1.6 + i * 1.27;
    card(s, 9.85, y, 2.85, 1.12, H.LIGHT);
    s.addText(a[1], { x: 10.0, y: y + 0.08, w: 2.6, h: 0.32, fontSize: 14, bold: true, color: a[0], margin: 0, isTextBox: true });
    s.addText(a[2], { x: 10.0, y: y + 0.4, w: 2.6, h: 0.7, fontSize: 11, color: H.INK, margin: 0, isTextBox: true, valign: 'top' });
  });
  s.addText('Renderizado de build_messages() para o 1º caso da amostra fixa, k = 3 (texto exato enviado à API)', { x: 0.6, y: pr.y + pr.h + 0.05, w: 9.0, h: 0.3, fontSize: 10, italic: true, color: H.GRAY, margin: 0, isTextBox: true });
  s.addNotes('Este é o texto exato que o código envia: SYSTEM fixo e USER com os exemplos e o caso. Na configuração com 3 exemplos há uma falha (desgaste 163 min, torque 51 Nm) e dois normais. O modelo devolve um JSON de uma linha.');

  // ===== 15. Etapa II resultados =====
  s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Etapa II' });
  crumb(s, 3); title(s, 'Etapa II: mais exemplos, melhor F1, até um teto');
  sub(s, 'DeepSeek na amostra fixa (200 casos, 50 falhas)');
  s.addChart(pres.charts.LINE, [
    { name: 'F1', labels: ['0', '3', '5', '10', '20'], values: [0.489, 0.578, 0.568, 0.652, 0.661] },
    { name: 'Precisão', labels: ['0', '3', '5', '10', '20'], values: [0.341, 0.446, 0.419, 0.518, 0.597] },
    { name: 'Revocação', labels: ['0', '3', '5', '10', '20'], values: [0.86, 0.82, 0.88, 0.88, 0.74] },
    { name: 'AUC-ROC', labels: ['0', '3', '5', '10', '20'], values: [0.721, 0.803, 0.802, 0.850, 0.843] },
  ], ax({ x: 0.5, y: 1.8, w: 6.4, h: 4.2, chartColors: [H.OR, 'F1B483', H.INK2, H.GRAY], lineSize: 2.5, lineDataSymbolSize: 8, showLegend: true, legendPos: 'b',
    valAxisMinVal: 0.3, valAxisMaxVal: 0.95, valAxisLabelFormatCode: '0.0', showCatAxisTitle: true, catAxisTitle: 'exemplos no prompt (k)', catAxisTitleFontSize: 11, catAxisTitleColor: '4A5560' }));
  s.addTable(tableStyle([
    ['zero-shot', '0,49', '83', '7', '272'], ['k = 3', '0,58', '51', '9', '472'], ['k = 5', '0,57', '61', '6', '600'],
    ['k = 10', { text: '0,65', options: { bold: true } }, '41', '6', '920'], ['k = 20', { text: '0,66', options: { bold: true, color: H.OR } }, '25', '13', '1.560'],
  ], ['Config.', 'F1', 'FP', 'FN', 'Tokens/consulta'], null, { hdr: H.OR, fs: 13 }), { x: 7.3, y: 1.8, w: 5.4, colW: [1.3, 0.8, 0.8, 0.8, 1.7], rowH: 0.36 });
  card(s, 7.3, 4.2, 5.4, 2.6, H.OR_L);
  bullets(s, [
    [{ text: 'Alarmista: ', options: { bold: true } }, { text: 'no zero-shot marca 83 de 150 normais como falha.' }],
    [{ text: 'Exemplos ensinam limites: ', options: { bold: true } }, { text: 'FP cai para 25 com k = 20.' }],
    [{ text: 'Teto: ', options: { bold: true } }, { text: 'de 10 para 20 exemplos, +70% de tokens e F1 igual; a revocação recua para 0,74.' }],
  ], 7.5, 4.4, 5.05, 2.3, 16);
  s.addNotes('Gráfico nativo com os números de reports/results/summary.csv (o mesmo de llm_f1_vs_k.png). A curva não é monótona: com 3 e 5 exemplos só aparecem falhas de dissipação de calor; a partir de 10 entram desgaste, potência e sobrecarga.');

  // ===== 16. CMs LLM =====
  s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Etapa II' });
  crumb(s, 3); title(s, 'Como o LLM erra: alarmes falsos caem com exemplos');
  [['k0', 'Zero-shot', '83 FP · 7 FN'], ['k10', 'Few-shot k = 10', '41 FP · 6 FN'], ['k20', 'Few-shot k = 20', '25 FP · 13 FN']].forEach((m, i) => {
    const x = 0.6 + i * 4.1;
    card(s, x, 1.6, 3.85, 4.4, H.LIGHT);
    s.addText(m[1], { x, y: 1.7, w: 3.85, h: 0.35, fontSize: 15, bold: true, color: H.OR, align: 'center', margin: 0, isTextBox: true });
    fitImage(s, path.join(FIG, `cm_llm_deepseek_deepseek-chat_${m[0]}.png`), x + 0.2, 2.1, 3.45, 3.3, { alt: 'Matriz de confusão do LLM ' + m[1] });
    s.addText(m[2], { x, y: 5.45, w: 3.85, h: 0.4, fontSize: 14, bold: true, color: H.INK, align: 'center', margin: 0, isTextBox: true });
  });
  s.addText([{ text: 'Regra de senso comum: ', options: { bold: true, color: H.OR } }, { text: 'os falsos positivos têm desgaste médio de 153 min contra 47 min dos acertos. O LLM associa "ferramenta gasta" a falha, mas as regras reais dependem de grandezas derivadas que ele teria de calcular sozinho.' }],
    { x: 0.6, y: 6.1, w: 12.1, h: 0.75, fontSize: 13, color: H.INK, margin: 0, isTextBox: true, valign: 'middle' });
  s.addNotes('Probabilidades pouco calibradas: 9 a 13 valores distintos por configuração. Só 58,5% dos casos têm a mesma resposta nas cinco configurações.');

  // ===== 17. Comparação F1 =====
  pres.addSection({ title: 'Comparação' });
  s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Comparação' });
  crumb(s, 4); title(s, 'Clássicos x LLM nos mesmos 200 casos');
  s.addChart(pres.charts.BAR, [{ name: 'F1', labels: ['MLP', 'XGBoost', 'SVM', 'Random Forest', 'LLM k=20', 'LLM k=10', 'LLM k=3', 'LLM k=5', 'LLM zero-shot'],
    values: [0.879, 0.879, 0.867, 0.818, 0.661, 0.652, 0.578, 0.568, 0.489] }],
  ax({ x: 0.5, y: 1.55, w: 7.8, h: 5.3, barDir: 'bar', catAxisOrientation: 'maxMin', chartColors: [H.TEAL, H.TEAL, H.TEAL, H.TEAL, H.OR, H.OR, H.OR, H.OR, H.OR],
    showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0.00', showLegend: false, valAxisMinVal: 0, valAxisMaxVal: 1, valAxisHidden: true, valGridLine: { style: 'none' },
    showTitle: true, title: 'F1 da classe falha (amostra fixa, 50 falhas)', barGapWidthPct: 45 }));
  card(s, 8.7, 1.6, 4.0, 1.6, H.TEAL_L);
  s.addText('Clássicos', { x: 8.9, y: 1.7, w: 3.6, h: 0.35, fontSize: 15, bold: true, color: H.TEAL, margin: 0, isTextBox: true });
  s.addText('F1 de 0,82 a 0,88 · AUC-ROC 0,96 a 0,98 · ~0,002 a 0,05 s por 100 casos', { x: 8.9, y: 2.05, w: 3.6, h: 1.05, fontSize: 13, color: H.INK, margin: 0, isTextBox: true, valign: 'top' });
  card(s, 8.7, 3.4, 4.0, 1.6, H.OR_L);
  s.addText('DeepSeek (prompt v1)', { x: 8.9, y: 3.5, w: 3.6, h: 0.35, fontSize: 15, bold: true, color: 'A4521A', margin: 0, isTextBox: true });
  s.addText('F1 de 0,49 a 0,66 · AUC-ROC até 0,85 · ~96 s por 100 casos', { x: 8.9, y: 3.85, w: 3.6, h: 1.05, fontSize: 13, color: H.INK, margin: 0, isTextBox: true, valign: 'top' });
  card(s, 8.7, 5.2, 4.0, 1.6, H.LIGHT);
  s.addText([{ text: 'A diferença é real: ', options: { bold: true } }, { text: 'bootstrap nos 200 casos dá IC 95% de 0,11 a 0,33 para F1(MLP) − F1(LLM k=20).' }],
    { x: 8.9, y: 5.2, w: 3.6, h: 1.6, fontSize: 13, color: H.INK, margin: 0, isTextBox: true, valign: 'middle' });
  s.addNotes('Mesmo o melhor LLM (0,66) fica abaixo do pior clássico (RF 0,82). Os valores da amostra fixa são mais altos que no teste completo por causa do enriquecimento com 25% de falhas.');

  // ===== 18. Onde cada um erra =====
  s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Comparação' });
  crumb(s, 4); title(s, 'Onde cada abordagem erra');
  card(s, 0.6, 1.55, 3.9, 4.6, H.TEAL_L);
  s.addText('MLP (Etapa I)', { x: 0.6, y: 1.65, w: 3.9, h: 0.35, fontSize: 15, bold: true, color: H.TEAL, align: 'center', margin: 0, isTextBox: true });
  fitImage(s, path.join(FIG, 'cm_mlp_eval_sample.png'), 0.8, 2.05, 3.5, 3.5, { alt: 'Matriz de confusão da MLP na amostra fixa' });
  s.addText('1 FP · 10 FN', { x: 0.6, y: 5.65, w: 3.9, h: 0.4, fontSize: 15, bold: true, color: H.INK, align: 'center', margin: 0, isTextBox: true });
  card(s, 4.75, 1.55, 3.9, 4.6, H.OR_L);
  s.addText('DeepSeek k = 20 (Etapa II)', { x: 4.75, y: 1.65, w: 3.9, h: 0.35, fontSize: 15, bold: true, color: 'A4521A', align: 'center', margin: 0, isTextBox: true });
  fitImage(s, path.join(FIG, 'cm_llm_deepseek_deepseek-chat_k20.png'), 4.95, 2.05, 3.5, 3.5, { alt: 'Matriz de confusão do LLM k=20' });
  s.addText('25 FP · 13 FN', { x: 4.75, y: 5.65, w: 3.9, h: 0.4, fontSize: 15, bold: true, color: H.INK, align: 'center', margin: 0, isTextBox: true });
  bullets(s, [
    [{ text: 'MLP quase não dá alarme falso ', options: { bold: true } }, { text: '(1 em 150 normais) e perde 10 falhas.' }],
    [{ text: 'O LLM gera 25 alarmes falsos ', options: { bold: true } }, { text: 'e ainda perde 13 falhas.' }],
    [{ text: 'Complementaridade: ', options: { bold: true, color: H.TEAL } }, { text: 'o LLM zero-shot pega 9 das 10 falhas que a MLP perde (quase todas por desgaste), ao custo de dezenas de alarmes.' }],
    [{ text: 'Probabilidades grosseiras: ', options: { bold: true } }, { text: 'com k = 20, rótulo e probabilidade se contradizem em 58 casos.' }],
  ], 8.95, 1.65, 3.8, 5.1, 14);
  s.addNotes('Falhas por desgaste ocorrem num intervalo quase aleatório de 200 a 240 min; são difíceis para todos.');

  // ===== 19. Precisão em operação =====
  s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Comparação' });
  crumb(s, 4); title(s, 'Na fábrica, com 3,4% de falhas, a diferença cresce');
  sub(s, 'Precisão reestimada para a taxa real de falhas a partir da revocação e dos FP medidos na amostra');
  s.addChart(pres.charts.BAR, [{ name: 'Precisão em operação', labels: ['DeepSeek zero-shot', 'DeepSeek k=20', 'MLP (medida no teste completo)', 'MLP (reestimada)'], values: [0.05, 0.14, 0.51, 0.81] }],
    ax({ x: 0.5, y: 1.9, w: 7.2, h: 4.9, barDir: 'bar', catAxisOrientation: 'maxMin', chartColors: [H.OR, H.OR, H.TEAL, '7FC8BF'], showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0.00',
      showLegend: false, valAxisMinVal: 0, valAxisMaxVal: 1, valAxisHidden: true, valGridLine: { style: 'none' }, barGapWidthPct: 40 }));
  card(s, 8.1, 1.95, 4.6, 2.2, H.OR_L);
  stat(s, 8.35, 2.0, 4.1, '6 de 7', 'alarmes do LLM (k = 20) seriam falsos em operação', H.OR, 44);
  card(s, 8.1, 4.4, 4.6, 2.4, H.LIGHT);
  s.addText('A reestimativa da MLP se apoia em um único FP na amostra e é otimista; o valor medido no teste completo (0,51) é a referência honesta. Mesmo assim, a vantagem dos clássicos continua grande.',
    { x: 8.3, y: 4.4, w: 4.25, h: 2.4, fontSize: 14, color: H.INK, margin: 0, isTextBox: true, valign: 'middle' });
  s.addNotes('Conta de Saito e Rehmsmeier (2015): precisão = rev·π / (rev·π + FPR·(1−π)), com π = 0,034.');

  // ===== 20. Tempo e custo =====
  s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Comparação' });
  crumb(s, 4); title(s, 'Tempo e custo');
  [[IC.clock, '~96 s', 'por 100 amostras no LLM (uma chamada por vez)', H.OR], [IC.bolt, '< 0,05 s', 'por 100 amostras nos clássicos, já treinados', H.TEAL], [IC.dollar, '~US$ 0,12', 'as 1.000 consultas da Etapa II (US$ 0,25 no pico)', H.INK2]].forEach((r, i) => {
    const x = 0.6 + i * 4.1;
    card(s, x, 1.6, 3.85, 1.9, H.LIGHT);
    iconCircle(s, r[0], x + 0.25, 1.85, 0.7, r[3]);
    s.addText(r[1], { x: x + 1.1, y: 1.75, w: 2.65, h: 0.75, fontFace: 'Cambria', fontSize: 30, bold: true, color: r[3], margin: 0, isTextBox: true, valign: 'middle' });
    s.addText(r[2], { x: x + 1.1, y: 2.5, w: 2.65, h: 0.85, fontSize: 12, color: H.INK2, margin: 0, isTextBox: true, valign: 'top' });
  });
  s.addChart(pres.charts.BAR, [{ name: 'Tokens de entrada por consulta', labels: ['zero-shot', 'k=3', 'k=5', 'k=10', 'k=20'], values: [272, 472, 600, 920, 1560] }],
    ax({ x: 0.5, y: 3.75, w: 6.0, h: 3.05, barDir: 'col', chartColors: ['F1B483'], showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '#,##0', showLegend: false,
      valAxisHidden: true, valGridLine: { style: 'none' }, showTitle: true, title: 'Tokens de entrada por consulta' }));
  s.addChart(pres.charts.BAR, [{ name: 'Custo por 100 amostras (US$)', labels: ['zero-shot', 'k=3', 'k=5', 'k=10', 'k=20'], values: [0.0050, 0.0080, 0.0100, 0.0148, 0.0244] }],
    ax({ x: 6.7, y: 3.75, w: 6.0, h: 3.05, barDir: 'col', chartColors: [H.OR], showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0.000', showLegend: false,
      valAxisHidden: true, valGridLine: { style: 'none' }, showTitle: true, title: 'Custo estimado por 100 amostras (US$, fora do pico)' }));
  s.addNotes('765 mil tokens de entrada e 16 mil de saída no total. Preço: US$ 0,15 / 0,60 por milhão (entrada / saída) fora do pico. O dinheiro é pouco; o tempo é cerca de quatro ordens de grandeza maior que o dos clássicos.');

  // ===== 21. Prós e contras =====
  s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: 'Comparação' });
  crumb(s, 4); title(s, 'Pontos positivos e negativos');
  const pc = (x, fill, head, color, ic, pros, cons) => {
    card(s, x, 1.6, 5.9, 5.2, fill);
    iconCircle(s, ic, x + 0.25, 1.8, 0.65, color);
    s.addText(head, { x: x + 1.05, y: 1.8, w: 4.6, h: 0.65, fontSize: 18, bold: true, color, margin: 0, valign: 'middle', isTextBox: true });
    const runs = [];
    pros.forEach((p) => runs.push({ text: '+  ' + p, options: { breakLine: true, color: H.INK, paraSpaceAfter: 12 } }));
    runs.push({ text: ' ', options: { breakLine: true, fontSize: 14 } });
    cons.forEach((p, i) => runs.push({ text: '−  ' + p, options: { breakLine: i < cons.length - 1, color: H.RED, paraSpaceAfter: 12 } }));
    s.addText(runs, { x: x + 0.3, y: 2.75, w: 5.35, h: 3.9, fontSize: 17, margin: 0, valign: 'top', isTextBox: true });
  };
  pc(0.6, H.TEAL_L, 'Modelos clássicos', H.TEAL, IC.cogs,
    ['F1 até 0,88 e AUC-ROC 0,98', 'Milissegundos por previsão, sem custo', 'Rodam localmente: dados ficam na empresa'],
    ['Precisam de milhares de exemplos rotulados', 'Exigem preparação, balanceamento e ajuste de hiperparâmetros']);
  pc(6.8, H.OR_L, 'LLM via prompting', 'A4521A', IC.robot,
    ['Funciona com 0 a 20 exemplos e sem treino', 'Tarefa descrita em linguagem natural', 'Melhora visivelmente com poucos exemplos'],
    ['F1 máximo 0,66 e muitos alarmes falsos', '~1 s e custo por consulta; dados vão para API externa', 'Modelo por trás do alias pode mudar sem aviso']);
  s.addNotes('Resumo da comparação crítica da Seção 6 do relatório.');

  // ===== 22. Conclusões =====
  s = pres.addSlide({ masterName: 'ESCURO', sectionTitle: 'Comparação' });
  s.addText('Conclusões do estudo', { x: 0.8, y: 0.6, w: 11.7, h: 0.8, fontFace: 'Cambria', fontSize: 36, bold: true, color: H.WHITE, margin: 0, isTextBox: true });
  [['Com dados rotulados, os clássicos vencem com folga', 'MLP e XGBoost: F1 0,88 contra 0,66 do melhor LLM, em milissegundos e sem custo.', '5FD3C6'],
    ['XGBoost é o melhor no teste completo', 'F1 0,76 com só 22 alarmes falsos em 2.000 ciclos.', '5FD3C6'],
    ['O LLM é utilizável sem treino', 'Detecta 86% das falhas no zero-shot e ganha com exemplos até k ≈ 10. Serve como triagem quando ainda não há dados.', 'F4A261'],
    ['Limitações', '50 falhas na amostra (IC do F1 ~0,2), um LLM, um prompt, uma semente; base sintética e pública.', 'C9D3DC'],
  ].forEach((r, i) => {
    const y = 1.65 + i * 1.3;
    s.addShape(pres.shapes.OVAL, { x: 0.8, y: y + 0.12, w: 0.5, h: 0.5, fill: { color: r[2] }, line: { color: r[2] } });
    s.addText(String(i + 1), { x: 0.8, y: y + 0.12, w: 0.5, h: 0.5, fontSize: 16, bold: true, color: H.INK, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    s.addText(r[0], { x: 1.55, y, w: 11.0, h: 0.45, fontSize: 19, bold: true, color: H.WHITE, margin: 0, isTextBox: true });
    s.addText(r[1], { x: 1.55, y: y + 0.45, w: 11.0, h: 0.6, fontSize: 14, color: 'C9D3DC', margin: 0, isTextBox: true });
  });
  s.addText('Próximo passo natural: dar ao LLM o conhecimento que os clássicos extraem dos dados  →  EXTRA', { x: 0.8, y: 6.75, w: 11.7, h: 0.45, fontSize: 14, italic: true, color: 'C6B3E6', margin: 0, isTextBox: true });
  s.addNotes('Fecha o estudo pedido no enunciado. O que vem a seguir é um experimento extra, à parte.');

  // ======================= EXTRA =======================
  pres.addSection({ title: 'EXTRA: LLM com conhecimento de domínio' });
  const SX = 'EXTRA: LLM com conhecimento de domínio';
  s = pres.addSlide({ masterName: 'ESCURO_EXTRA', sectionTitle: SX });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.8, y: 1.0, w: 2.6, h: 0.65, rectRadius: 0.32, fill: { color: H.GOLD }, line: { color: H.GOLD } });
  s.addText('★  EXTRA', { x: 0.8, y: 1.0, w: 2.6, h: 0.65, fontSize: 22, bold: true, color: '2D1B4A', align: 'center', valign: 'middle', margin: 0, isTextBox: true });
  s.addText('E se o LLM soubesse\ncomo a máquina falha?', { x: 0.8, y: 2.0, w: 8.0, h: 1.9, fontFace: 'Cambria', fontSize: 42, bold: true, color: H.WHITE, margin: 0, isTextBox: true, valign: 'top' });
  s.addText('Prompt v2 com grandezas derivadas, regras de falha da documentação da base, vizinhos parecidos como exemplos e limiar ajustado.',
    { x: 0.8, y: 4.1, w: 7.6, h: 1.0, fontSize: 18, color: 'D8CCEE', margin: 0, isTextBox: true });
  card(s, 9.0, 1.0, 3.7, 4.0, '3E2A63');
  s.addText('Por que fica separado', { x: 9.25, y: 1.2, w: 3.3, h: 0.45, fontSize: 16, bold: true, color: H.GOLD, margin: 0, isTextBox: true });
  s.addText([
    { text: 'Vai além do enunciado (prompt v2).', options: { bullet: { indent: 14 }, breakLine: true, paraSpaceAfter: 8 } },
    { text: 'Algumas variantes recebem regras que clássicos não recebem: não é comparação justa.', options: { bullet: { indent: 14 }, breakLine: true, paraSpaceAfter: 8 } },
    { text: 'O prompt v1 e summary.csv ficam intactos; resultados em reports/results/extra/.', options: { bullet: { indent: 14 } } },
  ], { x: 9.25, y: 1.75, w: 3.25, h: 3.1, fontSize: 14, color: 'E6DDF5', margin: 0, valign: 'top', isTextBox: true });
  s.addText('Mesma amostra fixa de 200 casos · DeepSeek · execução em 28/11/2026', { x: 0.8, y: 6.55, w: 8, h: 0.4, fontSize: 13, color: '9F8CC4', margin: 0, isTextBox: true });
  s.addNotes('A partir daqui é um experimento extra, fora do que o enunciado pede. A motivação veio das conclusões: o LLM erra porque não conhece as grandezas derivadas que definem as falhas.');

  // ===== Extra: desenho do experimento =====
  s = pres.addSlide({ masterName: 'EXTRA', sectionTitle: SX });
  crumbExtra(s, 'desenho'); title(s, 'Cinco variantes, dois tipos de ajuda', H.PU);
  // two columns: só dados de treino (justo) | conhecimento de domínio (injusto)
  card(s, 0.6, 1.6, 5.9, 4.2, 'FFFFFF', { line: 'C9B8E6', lw: 1 });
  s.addText([{ text: 'Só dados de treino  ', options: { bold: true, color: H.PU } }, { text: '(comparação justa)', options: { italic: true, color: H.GRAY_T } }], { x: 0.85, y: 1.75, w: 5.5, h: 0.4, fontSize: 16, margin: 0, isTextBox: true });
  [[IC.search, 'knn10', '10 exemplos = vizinhos mais parecidos no treino (em vez de sorteados)'],
    [IC.calc, 'derivados', 'zero-shot + ΔT, potência e desgaste × torque já calculados'],
  ].forEach((r, i) => {
    const y = 2.4 + i * 1.6;
    iconCircle(s, r[0], 0.85, y, 0.7, H.PU2);
    s.addText(r[1], { x: 1.75, y, w: 4.5, h: 0.4, fontSize: 16, bold: true, fontFace: 'Courier New', color: H.INK, margin: 0, isTextBox: true });
    s.addText(r[2], { x: 1.75, y: y + 0.42, w: 4.55, h: 0.9, fontSize: 13, color: H.INK2, margin: 0, isTextBox: true, valign: 'top' });
  });
  card(s, 6.8, 1.6, 5.9, 4.2, 'FFFFFF', { line: H.PU, lw: 1.5 });
  s.addText([{ text: 'Conhecimento de domínio  ', options: { bold: true, color: H.PU } }, { text: '(regras da documentação)', options: { italic: true, color: H.GRAY_T } }], { x: 7.05, y: 1.75, w: 5.5, h: 0.4, fontSize: 16, margin: 0, isTextBox: true });
  [[IC.book, 'regras', 'zero-shot + derivados + os 5 mecanismos de falha com limiares'],
    [IC.layers, 'regras_knn10', 'regras + derivados + 10 vizinhos'],
    [IC.brain, 'reasoner + regras', 'mesmo prompt de regras no deepseek-reasoner (raciocínio)'],
  ].forEach((r, i) => {
    const y = 2.35 + i * 1.12;
    iconCircle(s, r[0], 7.05, y, 0.65, H.PU);
    s.addText(r[1], { x: 7.9, y, w: 4.6, h: 0.35, fontSize: 15, bold: true, fontFace: 'Courier New', color: H.INK, margin: 0, isTextBox: true });
    s.addText(r[2], { x: 7.9, y: y + 0.36, w: 4.65, h: 0.62, fontSize: 13, color: H.INK2, margin: 0, isTextBox: true, valign: 'top' });
  });
  card(s, 0.6, 6.0, 12.1, 0.85, H.PU_L);
  iconCircle(s, IC.sliders, 0.75, 6.08, 0.68, H.PU);
  s.addText([{ text: 'Limiar ajustado: ', options: { bold: true, color: H.PU } }, { text: 'em vez de aceitar "falha" se p ≥ 0,5, o limiar é escolhido numa validação de 200 casos do TREINO e só então aplicado à amostra fixa. Referência sem LLM: as regras em Python.' }],
    { x: 1.6, y: 6.0, w: 11.0, h: 0.85, fontSize: 13, color: H.INK, margin: 0, valign: 'middle', isTextBox: true });
  s.addNotes('Código: src/llm/prompts_domain.py (PROMPT_VERSION v2) e src/run_llm_extra.py. O ajuste de limiar usa apenas dados de treino, então não há vazamento do teste.');

  // ===== Extra: print prompt v2 =====
  s = pres.addSlide({ masterName: 'EXTRA', sectionTitle: SX });
  crumbExtra(s, 'prompt v2'); title(s, 'O prompt v2: regras, derivados e vizinhos', H.PU);
  const p2 = fitImage(s, path.join(__dirname, 'prompt_v2.png'), 0.6, 1.5, 9.0, 5.45, { alignLeft: true, alignTop: true, alt: 'Print do prompt v2 regras + 10 vizinhos' });
  [['O que muda em relação ao v1', [
    ['Derivados: ', 'ΔT, potência e desgaste × torque calculados no código e enviados prontos.'],
    ['Mecanismos: ', 'os 5 modos de falha com seus limiares, tirados da documentação da AI4I.'],
    ['Vizinhos: ', 'os 10 casos do treino mais próximos do caso consultado, com rótulo.'],
    ['Saída: ', 'mesmo JSON; o limiar sobre a probabilidade é ajustado depois.'],
  ]]].forEach((blk) => {
    card(s, p2.x + p2.w + 0.35, 1.5, 12.7 - (p2.x + p2.w + 0.35), 5.35, H.PU_L);
    const bx = p2.x + p2.w + 0.55, bw = 12.7 - bx - 0.2;
    s.addText(blk[0], { x: bx, y: 1.65, w: bw, h: 0.4, fontSize: 15, bold: true, color: H.PU, margin: 0, isTextBox: true });
    bullets(s, blk[1].map((b) => [{ text: b[0], options: { bold: true } }, { text: b[1] }]), bx, 2.15, bw, 4.6, 12);
  });
  s.addNotes('Print do texto exato salvo em reports/results/extra/prompts/v2_regras_knn10.txt; os outros 7 vizinhos foram omitidos só na imagem. A variante "regras" é esta sem a lista de vizinhos; "knn10" é esta sem derivados nem regras.');

  // ===== Extra: resultados F1 =====
  s = pres.addSlide({ masterName: 'EXTRA', sectionTitle: SX });
  crumbExtra(s, 'resultados'); title(s, 'Conhecimento de domínio muda o jogo', H.PU);
  const exLab = ['MLP / XGBoost (Etapa I)', 'LLM v1 k=20 (enunciado)', 'v2 derivados', 'v2 knn10', 'v2 knn10, limiar 0,25', 'v2 regras', 'v2 regras_knn10, limiar 0,12', 'v2 reasoner + regras', 'Regras em Python, sem LLM'];
  const exVal = [0.879, 0.661, 0.468, 0.571, 0.782, 0.718, 0.844, 0.864, 0.913];
  s.addChart(pres.charts.BAR, [{ name: 'F1', labels: exLab, values: exVal }],
    ax({ x: 0.5, y: 1.5, w: 8.0, h: 5.35, barDir: 'bar', catAxisOrientation: 'maxMin', chartColors: [H.TEAL, H.OR, H.PU2, H.PU2, H.PU2, H.PU, H.PU, H.PU, H.GRAY],
      showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0.00', showLegend: false, valAxisMinVal: 0, valAxisMaxVal: 1, valAxisHidden: true, valGridLine: { style: 'none' },
      barGapWidthPct: 40, showTitle: true, title: 'F1 da classe falha, amostra fixa (200 casos, 50 falhas)' }));
  // legenda manual
  [[H.TEAL, 'Clássico (referência)'], [H.OR, 'LLM do enunciado'], [H.PU2, 'v2, só dados de treino'], [H.PU, 'v2, com regras de domínio'], [H.GRAY, 'Regras sem LLM']].forEach((l, i) => {
    s.addShape(pres.shapes.RECTANGLE, { x: 8.85, y: 1.65 + i * 0.36, w: 0.22, h: 0.22, fill: { color: l[0] }, line: { color: l[0] } });
    s.addText(l[1], { x: 9.15, y: 1.6 + i * 0.36, w: 3.5, h: 0.32, fontSize: 12, color: H.INK, margin: 0, isTextBox: true, valign: 'middle' });
  });
  card(s, 8.85, 3.6, 3.85, 1.5, 'FFFFFF', { line: H.PU2 });
  s.addText([{ text: 'Melhor resultado justo: 0,78', options: { bold: true, color: H.PU, breakLine: true } }, { text: 'knn10 com limiar 0,25. Só com dados de treino, sobe de 0,66 para 0,78.' }],
    { x: 9.05, y: 3.6, w: 3.5, h: 1.5, fontSize: 13, color: H.INK, margin: 0, isTextBox: true, valign: 'middle' });
  card(s, 8.85, 5.3, 3.85, 1.55, H.PU_L);
  s.addText([{ text: 'Com regras: até 0,86', options: { bold: true, color: H.PU, breakLine: true } }, { text: 'mas as regras puras em Python dão 0,91, acima de todos.' }],
    { x: 9.05, y: 5.3, w: 3.5, h: 1.55, fontSize: 13, color: H.INK, margin: 0, isTextBox: true, valign: 'middle' });
  s.addNotes('Mesmos números de reports/results/extra/summary_extra.csv (também em reports/figures/extra_f1.png). Derivados sozinhos pioram: o LLM fica ainda mais alarmista (104 FP).');

  // ===== Extra: tabela completa =====
  s = pres.addSlide({ masterName: 'EXTRA', sectionTitle: SX });
  crumbExtra(s, 'tabela'); title(s, 'Todas as variantes, todas as métricas', H.PU);
  const R = (a, opts = {}) => a.map((c, i) => (i === 0 ? { text: c, options: Object.assign({ bold: true }, opts) } : { text: c, options: opts }));
  s.addTable(tableStyle([
    R(['knn10', 'não', '0,50', '1,00', '0,40', '0,57', '0,94', '0', '30', '101', '0,015']),
    R(['knn10', 'não', '0,25', '0,92', '0,68', '0,78', '0,94', '3', '16', '101', '0,015'], { fill: { color: 'EFE8F8' } }),
    R(['derivados', 'não', '0,50', '0,31', '0,94', '0,47', '0,71', '104', '3', '89', '0,006']),
    R(['regras', 'sim', '0,50', '1,00', '0,56', '0,72', '0,87', '0', '22', '91', '0,010']),
    R(['regras_knn10', 'sim', '0,50', '1,00', '0,48', '0,65', '0,98', '0', '26', '90', '0,025']),
    R(['regras_knn10', 'sim', '0,12', '0,95', '0,76', '0,84', '0,98', '2', '12', '90', '0,025']),
    R(['reasoner + regras', 'sim', '0,50', '1,00', '0,76', '0,86', '0,91', '0', '12', '487', '0,053']),
    R(['reasoner + regras', 'sim', '0,02', '0,84', '0,86', '0,85', '0,91', '8', '7', '487', '0,053']),
    R(['regras em Python', 'sim', '–', '1,00', '0,84', '0,91', '–', '0', '8', '0', '0'], { color: '5F6B76' }),
  ], ['Variante', 'Regras?', 'Limiar', 'Precisão', 'Revocação', 'F1', 'AUC', 'FP', 'FN', 'Tempo/100 [s]', 'US$/100'], null, { hdr: H.PU, fs: 12 }),
  { x: 0.6, y: 1.55, w: 12.1, colW: [2.3, 0.95, 0.9, 1.05, 1.15, 0.85, 0.85, 0.8, 0.8, 1.35, 1.1], rowH: 0.42 });
  s.addText('Amostra fixa de 200 casos (50 falhas). Limiar escolhido numa validação de 200 casos do treino. Fonte: reports/results/extra/summary_extra.csv. A linha destacada é o melhor resultado sem conhecimento de domínio.',
    { x: 0.6, y: 6.25, w: 12.1, h: 0.6, fontSize: 12, italic: true, color: H.GRAY_T, margin: 0, isTextBox: true });
  s.addNotes('Precisão 1,00 em várias variantes com regras: o modelo só diz falha quando uma regra é claramente violada. O reasoner é 5 vezes mais lento e teve 7 respostas vazias (limite de 8.000 tokens).');

  // ===== Extra: CMs =====
  s = pres.addSlide({ masterName: 'EXTRA', sectionTitle: SX });
  crumbExtra(s, 'matrizes'); title(s, 'Matrizes de confusão das variantes (limiar 0,5)', H.PU);
  [['deepseek-chat_derivados', 'derivados', '104 FP · 3 FN', H.PU2], ['deepseek-chat_knn10', 'knn10', '0 FP · 30 FN', H.PU2], ['deepseek-chat_regras', 'regras', '0 FP · 22 FN', H.PU],
    ['deepseek-chat_regras_knn10', 'regras_knn10', '0 FP · 26 FN', H.PU], ['deepseek-reasoner_regras', 'reasoner + regras', '0 FP · 12 FN', H.PU]].forEach((m, i) => {
    const x = 0.6 + i * 2.46;
    card(s, x, 1.55, 2.3, 3.6, 'FFFFFF', { line: 'DCD0EF' });
    s.addText(m[1], { x, y: 1.62, w: 2.3, h: 0.32, fontSize: 13, bold: true, fontFace: 'Courier New', color: m[3], align: 'center', margin: 0, isTextBox: true });
    fitImage(s, path.join(FIG, `extra_cm_deepseek_${m[0]}.png`), x + 0.1, 1.98, 2.1, 2.6, { alt: 'Matriz de confusão ' + m[1] });
    s.addText(m[2], { x, y: 4.65, w: 2.3, h: 0.4, fontSize: 13, bold: true, color: H.INK, align: 'center', margin: 0, isTextBox: true });
  });
  card(s, 0.6, 5.4, 5.9, 1.45, H.PU_L);
  s.addText([{ text: 'Derivados sem regras: ', options: { bold: true, color: H.PU } }, { text: 'mais números "assustadores" deixam o LLM ainda mais alarmista (104 de 150 normais).' }],
    { x: 0.8, y: 5.4, w: 5.55, h: 1.45, fontSize: 13, color: H.INK, margin: 0, isTextBox: true, valign: 'middle' });
  card(s, 6.8, 5.4, 5.9, 1.45, H.PU_L);
  s.addText([{ text: 'Vizinhos e regras: ', options: { bold: true, color: H.PU } }, { text: 'o LLM vira o oposto, conservador: zero alarme falso, mas perde falhas. Por isso o limiar importa.' }],
    { x: 7.0, y: 5.4, w: 5.55, h: 1.45, fontSize: 13, color: H.INK, margin: 0, isTextBox: true, valign: 'middle' });
  s.addNotes('Imagens geradas por src/run_llm_extra.py em reports/figures/extra_cm_*.png, todas no limiar padrão 0,5. A variante regras com deepseek-chat erra 14 de 23 falhas de dissipação de calor: não aplica bem a condição composta ΔT e rotação.');

  // ===== Extra: limiar =====
  s = pres.addSlide({ masterName: 'EXTRA', sectionTitle: SX });
  crumbExtra(s, 'limiar'); title(s, 'O LLM ordena bem, mas decide mal: ajuste o limiar', H.PU);
  s.addChart(pres.charts.BAR, [
    { name: 'Limiar 0,5', labels: ['knn10', 'regras_knn10', 'reasoner + regras'], values: [0.571, 0.649, 0.864] },
    { name: 'Limiar ajustado no treino', labels: ['knn10', 'regras_knn10', 'reasoner + regras'], values: [0.782, 0.844, 0.852] },
  ], ax({ x: 0.5, y: 1.55, w: 7.2, h: 5.3, barDir: 'col', barGapWidthPct: 55, chartColors: ['C9B8E6', H.PU], showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0.00',
    showLegend: true, legendPos: 'b', valAxisMinVal: 0, valAxisMaxVal: 1, valAxisLabelFormatCode: '0.0', showTitle: true, title: 'F1 antes e depois de ajustar o limiar' }));
  [['0,94', 'AUC-ROC do knn10: a probabilidade ordena bem os casos (v1 chegava a 0,85)'], ['0,25 e 0,12', 'limiares escolhidos na validação: o LLM subestima a própria probabilidade de falha'], ['+0,21', 'de F1 no knn10 só mudando o limiar']].forEach((r, i) => {
    card(s, 8.1, 1.55 + i * 1.8, 4.6, 1.6, i === 2 ? H.PU_L : 'FFFFFF', { line: 'DCD0EF' });
    s.addText(r[0], { x: 8.3, y: 1.6 + i * 1.8, w: 4.2, h: 0.7, fontFace: 'Cambria', fontSize: 30, bold: true, color: H.PU, margin: 0, isTextBox: true, valign: 'middle' });
    s.addText(r[1], { x: 8.3, y: 2.3 + i * 1.8, w: 4.2, h: 0.8, fontSize: 13, color: H.INK, margin: 0, isTextBox: true, valign: 'top' });
  });
  s.addNotes('No reasoner o limiar ajustado não ajuda (0,86 para 0,85): ele já decide bem com regras. Ajustar o limiar no treino é o mesmo que os clássicos fazem implicitamente ao otimizar F1.');

  // ===== Extra: leitura crítica =====
  s = pres.addSlide({ masterName: 'EXTRA', sectionTitle: SX });
  crumbExtra(s, 'leitura crítica'); title(s, 'Leitura crítica: quem está acertando, o LLM ou as regras?', H.PU);
  [[IC.code, '0,91', 'F1 das regras escritas em Python, sem LLM, precisão 1,00', H.GRAY],
    [IC.brain, '0,86', 'F1 do deepseek-reasoner com regras, o melhor LLM', H.PU],
    [IC.clock, '487 s', 'por 100 casos no reasoner, 5× o chat e 7 respostas vazias', H.OR]].forEach((r, i) => {
    const x = 0.6 + i * 4.1;
    card(s, x, 1.6, 3.85, 2.0, 'FFFFFF', { line: 'DCD0EF' });
    iconCircle(s, r[0], x + 0.25, 1.85, 0.7, r[3]);
    s.addText(r[1], { x: x + 1.1, y: 1.75, w: 2.6, h: 0.75, fontFace: 'Cambria', fontSize: 32, bold: true, color: r[3], margin: 0, isTextBox: true, valign: 'middle' });
    s.addText(r[2], { x: x + 1.1, y: 2.5, w: 2.65, h: 1.0, fontSize: 12, color: H.INK2, margin: 0, isTextBox: true, valign: 'top' });
  });
  // diagram: regras -> gerador -> dados
  box(s, 0.6, 4.0, 2.7, 1.0, H.GRAY, 'Regras da documentação', { color: H.WHITE, bold: true, fs: 13 });
  arrow(s, 3.3, 4.5, 3.8, 4.5, H.GRAY, 2);
  box(s, 3.8, 4.0, 2.5, 1.0, H.LIGHT, 'geram os rótulos\nda base sintética', { fs: 13 });
  arrow(s, 6.3, 4.5, 6.8, 4.5, H.GRAY, 2);
  box(s, 6.8, 4.0, 2.6, 1.0, H.PU_L, 'LLM com regras\nsó as aplica', { fs: 13, color: H.PU, bold: true });
  card(s, 9.7, 4.0, 3.0, 2.85, H.PU_L);
  s.addText([{ text: 'Por isso não é justo ', options: { bold: true, color: H.PU } }, { text: 'comparar "LLM + regras" com os clássicos: as regras são, na prática, o gerador dos dados. Em uma fábrica real, essas regras não existem prontas.' }],
    { x: 9.9, y: 4.0, w: 2.65, h: 2.85, fontSize: 13, color: H.INK, margin: 0, isTextBox: true, valign: 'middle' });
  s.addText([{ text: 'O que sobra de útil: ', options: { bold: true, color: H.PU } }, { text: 'o LLM consegue seguir regras escritas em linguagem natural (0,72 no chat, 0,86 com raciocínio), mas o chat ainda erra 14 de 23 falhas de dissipação de calor, cuja condição é composta (ΔT e rotação).' }],
    { x: 0.6, y: 5.2, w: 8.8, h: 1.65, fontSize: 14, color: H.INK, margin: 0, isTextBox: true, valign: 'middle' });
  s.addNotes('As regras em Python sem a faixa de desgaste dão 0,91; com a faixa de desgaste 200-240 min caem para 0,86 por causa de alarmes falsos. O reasoner usa raciocínio estendido, por isso gasta muito mais tokens de saída (146 mil contra 3 mil).');

  // ===== Extra: conclusões =====
  s = pres.addSlide({ masterName: 'ESCURO_EXTRA', sectionTitle: SX });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.8, y: 0.6, w: 2.2, h: 0.5, rectRadius: 0.25, fill: { color: H.GOLD }, line: { color: H.GOLD } });
  s.addText('★  EXTRA', { x: 0.8, y: 0.6, w: 2.2, h: 0.5, fontSize: 16, bold: true, color: '2D1B4A', align: 'center', valign: 'middle', margin: 0, isTextBox: true });
  s.addText('O que o extra ensina', { x: 0.8, y: 1.3, w: 11.7, h: 0.8, fontFace: 'Cambria', fontSize: 36, bold: true, color: H.WHITE, margin: 0, isTextBox: true });
  [['Exemplos certos valem mais que mais exemplos', 'Vizinhos parecidos + limiar ajustado no treino: F1 0,78, contra 0,66 do v1. Ainda abaixo dos clássicos (0,82 a 0,88).'],
    ['Números soltos não bastam', 'Dar só as grandezas derivadas piora (0,47): sem saber o que fazer com elas, o LLM fica mais alarmista.'],
    ['Conhecimento explícito ajuda muito', 'Com as regras, 0,72 a 0,86. Mas as regras sozinhas dão 0,91: o LLM vira um executor de regras caro e lento.'],
    ['A conclusão principal se mantém', 'Com dados rotulados, modelos treinados continuam a melhor escolha; o LLM brilha quando há conhecimento em texto e poucos dados.'],
  ].forEach((r, i) => {
    const y = 2.35 + i * 1.12;
    s.addShape(pres.shapes.OVAL, { x: 0.8, y: y + 0.08, w: 0.45, h: 0.45, fill: { color: H.GOLD }, line: { color: H.GOLD } });
    s.addText(String(i + 1), { x: 0.8, y: y + 0.08, w: 0.45, h: 0.45, fontSize: 15, bold: true, color: '2D1B4A', align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    s.addText(r[0], { x: 1.5, y, w: 11.0, h: 0.42, fontSize: 18, bold: true, color: H.WHITE, margin: 0, isTextBox: true });
    s.addText(r[1], { x: 1.5, y: y + 0.42, w: 11.0, h: 0.55, fontSize: 14, color: 'D8CCEE', margin: 0, isTextBox: true });
  });
  s.addNotes('Fecha o extra. Reforçar que ele não muda a conclusão do estudo pedido.');

  // ===== Encerramento =====
  pres.addSection({ title: 'Encerramento' });
  s = pres.addSlide({ masterName: 'ESCURO', sectionTitle: 'Encerramento' });
  s.addText('Obrigado!', { x: 0.8, y: 1.0, w: 8, h: 1.1, fontFace: 'Cambria', fontSize: 54, bold: true, color: H.WHITE, margin: 0, isTextBox: true });
  s.addText('Perguntas?', { x: 0.8, y: 2.1, w: 8, h: 0.6, fontSize: 24, color: 'C9D3DC', margin: 0, isTextBox: true });
  [['0,88', 'F1 clássico (MLP / XGBoost)', '5FD3C6'], ['0,66', 'F1 do LLM, prompt do enunciado', 'F4A261'], ['0,78', 'F1 do LLM com vizinhos + limiar (EXTRA)', 'C6B3E6']].forEach((r, i) => {
    const x = 0.8 + i * 4.0;
    card(s, x, 3.4, 3.7, 1.9, '28394A');
    s.addText(r[0], { x: x + 0.25, y: 3.5, w: 3.2, h: 0.9, fontFace: 'Cambria', fontSize: 44, bold: true, color: r[2], margin: 0, isTextBox: true });
    s.addText(r[1], { x: x + 0.25, y: 4.4, w: 3.2, h: 0.75, fontSize: 14, color: 'C9D3DC', margin: 0, isTextBox: true });
  });
  s.addText('Código, resultados e relatório: predictive-maintenance-ml-vs-llm (src/, reports/results/, reports/relatorio/)', { x: 0.8, y: 6.2, w: 11.7, h: 0.4, fontSize: 13, color: '9FB0BF', margin: 0, isTextBox: true });
  s.addNotes('Três números para lembrar: 0,88 clássico, 0,66 LLM no enunciado, 0,78 LLM melhorado de forma justa no extra.');

  const out = path.join(__dirname, 'apresentacao.pptx');
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log('ok', out);
})();
