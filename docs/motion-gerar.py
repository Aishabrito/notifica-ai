"""
Notifica.ai — motion 9:16 de 15 s ("pare de dar F5")
Gera os quadros com PIL/numpy, sintetiza o som com numpy e junta tudo com ffmpeg.
Uso: python3 gerar.py <pasta_saida>
"""
import math
import random
import subprocess
import sys
import wave
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "out")
OUT.mkdir(parents=True, exist_ok=True)

W, H, FPS, DUR = 1080, 1920, 30, 15.0
N = int(FPS * DUR)
SR = 44100
random.seed(7)
rng = np.random.default_rng(7)

# ── Marca (mesmas cores do site) ───────────────────────────────
BG = (10, 10, 10)
INK = (245, 242, 235)
EM = (52, 211, 153)
EM_DARK = (6, 78, 59)
PURPLE = (192, 132, 252)
RED = (248, 113, 113)
AMBER = (251, 191, 36)
GRAY = (115, 115, 115)
CARD = (22, 22, 22)

FONTS = "/usr/share/fonts/opentype/inter/"
MONO = "/usr/share/fonts/truetype/jetbrains-mono/"
EMOJI = "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"


@lru_cache(None)
def F(nome, tam):
    caminho = {
        "black": FONTS + "InterDisplay-Black.otf",
        "xbold": FONTS + "InterDisplay-ExtraBold.otf",
        "bold": FONTS + "Inter-Bold.otf",
        "semi": FONTS + "Inter-SemiBold.otf",
        "reg": FONTS + "Inter-Regular.otf",
        "mono": MONO + "JetBrainsMono-Bold.ttf",
        "monor": MONO + "JetBrainsMono-Regular.ttf",
    }[nome]
    return ImageFont.truetype(caminho, tam)


# ── Curvas de movimento ────────────────────────────────────────
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def p(t, a, b):
    """progresso 0..1 de t entre a e b"""
    return clamp((t - a) / (b - a)) if b > a else float(t >= a)


def out_cubic(x):
    return 1 - (1 - x) ** 3


def out_expo(x):
    return 1.0 if x >= 1 else 1 - 2 ** (-10 * x)


def in_out(x):
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def out_back(x, s=1.9):
    x -= 1
    return 1 + (s + 1) * x ** 3 + s * x ** 2


def spring(x, k=11.0, d=5.5):
    """mola amortecida: passa do ponto e volta"""
    if x <= 0:
        return 0.0
    return 1 - math.exp(-d * x) * math.cos(k * x)


def lerp(a, b, x):
    return a + (b - a) * x


def mix(c1, c2, x):
    return tuple(int(lerp(a, b, x)) for a, b in zip(c1, c2))


# ── Linha do tempo (o som e a imagem usam os mesmos eventos) ───
CLIQUES = []
t = 0.18
while t < 2.5:
    CLIQUES.append(round(t, 3))
    t += max(0.045, 0.24 * (1 - t / 2.6) ** 1.4 + 0.04)

PALAVRAS = [
    ("E SE SAIU?", RED), ("LISTA DE ESPERA", INK), ("RETIFICAÇÃO", AMBER),
    ("2ª CHAMADA", INK), ("GABARITO", PURPLE), ("CONVOCAÇÃO", RED),
    ("NOMEAÇÃO", INK), ("PRAZO!!", AMBER), ("E SE EU PERDI?", RED),
    ("F5", INK), ("F5", RED), ("F5", INK),
]
SLAMS = []
t = 2.62
for i in range(len(PALAVRAS)):
    SLAMS.append(round(t, 3))
    t += max(0.07, 0.24 * (0.8 ** i))
WHITEOUT = 4.32
BATIMENTOS = [2.62 + i * 0.42 for i in range(5)]

DIGITAR = [("> para.", 4.55), ("> deixa comigo.", 4.95)]
LOGO_T = 5.4
POV_T = 7.4
NOTIFS = [8.35, 9.35, 10.35]
SPLIT_T = 11.6
CTA_T = 13.4
BPM_INICIO, BATIDA = 7.4, 0.5  # 120 bpm


# ── Peças gráficas (em cache) ──────────────────────────────────
@lru_cache(None)
def texto(s, fonte, tam, cor, contorno=0, cor_contorno=(0, 0, 0)):
    f = F(fonte, tam)
    x0, y0, x1, y1 = f.getbbox(s, stroke_width=contorno)
    pad = 6 + contorno
    im = Image.new("RGBA", (x1 - x0 + pad * 2, y1 - y0 + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((pad - x0, pad - y0), s, font=f, fill=cor + (255,),
                            stroke_width=contorno, stroke_fill=cor_contorno + (255,))
    return im


@lru_cache(None)
def letra(ch, fonte, tam, cor):
    """uma letra numa caixa da altura da fonte (mantém a linha de base)"""
    f = F(fonte, tam)
    asc, desc = f.getmetrics()
    w = int(f.getlength(ch)) + 12
    im = Image.new("RGBA", (w, asc + desc + 12), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((6, 6), ch, font=f, fill=cor + (255,))
    return im


@lru_cache(None)
def emoji(ch, tam):
    f = ImageFont.truetype(EMOJI, 109)
    im = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((10, 10), ch, font=f, embedded_color=True)
    bbox = im.getbbox() or (0, 0, 160, 160)
    im = im.crop(bbox)
    r = tam / max(im.size)
    return im.resize((max(1, int(im.width * r)), max(1, int(im.height * r))), Image.LANCZOS)


@lru_cache(None)
def sino(tam, cor):
    """sino desenhado à mão (o mesmo símbolo do logo do site)"""
    s = 4  # supersampling
    T = tam * s
    im = Image.new("RGBA", (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = cor + (255,)
    cx = T / 2
    # corpo: cúpula + saia
    d.ellipse([cx - T * 0.25, T * 0.14, cx + T * 0.25, T * 0.58], fill=c)
    d.polygon([(cx - T * 0.25, T * 0.38), (cx + T * 0.25, T * 0.38),
               (cx + T * 0.36, T * 0.70), (cx - T * 0.36, T * 0.70)], fill=c)
    d.rounded_rectangle([cx - T * 0.40, T * 0.66, cx + T * 0.40, T * 0.75], radius=T * 0.04, fill=c)
    # pegador e badalo
    d.ellipse([cx - T * 0.06, T * 0.06, cx + T * 0.06, T * 0.18], fill=c)
    d.ellipse([cx - T * 0.09, T * 0.76, cx + T * 0.09, T * 0.92], fill=c)
    return im.resize((tam, tam), Image.LANCZOS)


@lru_cache(None)
def tecla(rotulo, tam, cor_tampa=(38, 38, 38), cor_txt=INK):
    """tecla de teclado em 3/4"""
    im = Image.new("RGBA", (tam, int(tam * 1.08)), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = int(tam * 0.16)
    d.rounded_rectangle([0, int(tam * 0.08), tam - 1, int(tam * 1.08) - 1], radius=r, fill=(12, 12, 12, 255))
    d.rounded_rectangle([0, 0, tam - 1, tam - 1], radius=r, fill=cor_tampa + (255,), outline=(70, 70, 70, 255), width=4)
    t = texto(rotulo, "black", int(tam * 0.42), cor_txt)
    im.alpha_composite(t, (tam // 2 - t.width // 2, tam // 2 - t.height // 2 - 4))
    return im


@lru_cache(None)
def janela(url, w, h, seed):
    """janela de navegador "carregando" """
    rr = random.Random(seed)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=26, fill=(24, 24, 24, 250), outline=(60, 60, 60, 255), width=3)
    d.rounded_rectangle([0, 0, w - 1, 64], radius=26, fill=(34, 34, 34, 255))
    d.rectangle([0, 40, w - 1, 64], fill=(34, 34, 34, 255))
    for i, c in enumerate([(248, 113, 113), (251, 191, 36), (52, 211, 153)]):
        d.ellipse([22 + i * 30, 22, 40 + i * 30, 40], fill=c + (255,))
    d.rounded_rectangle([120, 14, w - 24, 50], radius=14, fill=(14, 14, 14, 255))
    t = texto(url, "monor", 22, (160, 160, 160))
    im.alpha_composite(t, (136, 32 - t.height // 2))
    y = 100
    while y < h - 40:
        ww = rr.randint(int(w * 0.3), w - 80)
        d.rounded_rectangle([36, y, 36 + ww, y + 16], radius=8, fill=(48, 48, 48, 255))
        y += 36
    return im


def put(fr, camada, cx, cy, escala=1.0, rot=0.0, alpha=1.0):
    if alpha <= 0.01 or escala <= 0.01:
        return
    im = camada
    if abs(escala - 1) > 0.005:
        im = im.resize((max(1, int(im.width * escala)), max(1, int(im.height * escala))), Image.BICUBIC)
    if abs(rot) > 0.05:
        im = im.rotate(rot, resample=Image.BICUBIC, expand=True)
    if alpha < 0.999:
        a = im.getchannel("A").point(lambda v: int(v * alpha))
        im = im.copy()
        im.putalpha(a)
    fr.paste(im, (int(cx - im.width / 2), int(cy - im.height / 2)), im)


# fundos pré-calculados
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
VINHETA = (1 - 0.55 * (((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H / 2) / (H * 0.7)) ** 2)).clip(0.35, 1)[..., None]
GRAOS = [rng.integers(-7, 8, (H, W, 1), dtype=np.int16) for _ in range(4)]
GRADE = Image.new("RGB", (W, H), BG)
_g = ImageDraw.Draw(GRADE)
for gx in range(0, W, 60):
    _g.line([(gx, 0), (gx, H)], fill=(18, 18, 18))
for gy in range(0, H, 60):
    _g.line([(0, gy), (W, gy)], fill=(18, 18, 18))


@lru_cache(None)
def documento():
    """página de edital comprida, para o Vigia "ler" no fundo"""
    rr = random.Random(3)
    im = Image.new("RGBA", (W, 4200), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    frases = ["EDITAL Nº 12/2026", "Art. 4º — Das inscrições", "retificação do item 9.3", "lista de classificados",
              "convocação para matrícula", "resultado preliminar", "prazo para recurso", "anexo II — cronograma"]
    y = 0
    while y < 4150:
        if rr.random() < 0.18:
            t = texto(rr.choice(frases), "mono", 30, (70, 70, 70))
            im.alpha_composite(t, (70, y))
            y += 58
        else:
            ww = rr.randint(300, 940)
            d.rounded_rectangle([70, y + 8, 70 + ww, y + 22], radius=7, fill=(34, 34, 34, 255))
            y += 34
    return im


@lru_cache(None)
def cartao_notif(emo, titulo, corpo, w=600):
    h = 214
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=34, fill=(30, 30, 30, 255), outline=(62, 62, 62, 255), width=2)
    im.alpha_composite(sino(34, EM), (26, 24))
    im.alpha_composite(texto("NOTIFICA.AI · agora", "mono", 21, (150, 150, 150)), (70, 26))
    e = emoji(emo, 44)
    im.alpha_composite(e, (26, 82))
    im.alpha_composite(texto(titulo, "bold", 31, INK), (84, 76))
    yy_ = 124
    for linha in corpo.split("\n"):
        im.alpha_composite(texto(linha, "reg", 27, (200, 200, 200)), (84, yy_))
        yy_ += 38
    return im


@lru_cache(None)
def celular():
    w, h = 680, 1180
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=96, fill=(6, 6, 6, 255), outline=(80, 80, 80, 255), width=10)
    d.rounded_rectangle([22, 22, w - 23, h - 23], radius=78, fill=(14, 14, 14, 255))
    d.rounded_rectangle([w / 2 - 110, 44, w / 2 + 110, 92], radius=24, fill=(0, 0, 0, 255))
    hora = texto("09:41", "black", 120, INK)
    im.alpha_composite(hora, (w // 2 - hora.width // 2, 150))
    dia = texto("quarta-feira, 4 de novembro", "semi", 26, (170, 170, 170))
    im.alpha_composite(dia, (w // 2 - dia.width // 2, 300))
    return im


NOTIFICACOES = [
    ("🎓", "UFRJ · Lista de espera", "Saiu a 2ª chamada.\nSua posição: 38 (faltam 3)"),
    ("📰", "Diário Oficial · seu nome", "NOMEAÇÃO publicada hoje.\nPrazo de posse: 30 dias"),
    ("📅", "ENEM 2026", "1º dia de prova é amanhã.\nPortões fecham às 13h"),
]


# ── Cenas ──────────────────────────────────────────────────────
def cena_f5(fr, t):
    d = ImageDraw.Draw(fr)
    # janelas pipocando (uma a cada poucos cliques)
    urls = ["sisu.mec.gov.br", "cebraspe.org.br/concursos", "in.gov.br/dou", "vestibular.uerj.br",
            "conhecimento.fgv.br", "acessounico.mec.gov.br", "inep.gov.br/enem", "fuvest.br"]
    for i, ct in enumerate(CLIQUES[::2]):
        if t < ct:
            break
        rr = random.Random(i * 31)
        x = rr.randint(160, W - 160)
        y = rr.randint(320, H - 380)
        k = spring(p(t, ct, ct + 0.5))
        put(fr, janela(urls[i % len(urls)], 560, 380, i), x, y, escala=0.6 + 0.4 * k, rot=rr.uniform(-14, 14), alpha=min(1, k * 1.4) * 0.95)
    # tecla F5 no centro: afunda a cada clique
    ultimo = max([c for c in CLIQUES if c <= t], default=-9)
    aperto = 1 - p(t, ultimo, ultimo + 0.1)
    put(fr, tecla("F5", 300), W / 2, H / 2 + 40 + 22 * aperto, escala=1 - 0.08 * aperto + 0.05 * spring(p(t, 0, 0.4)) - 0.05)
    # contador
    n = sum(1 for c in CLIQUES if c <= t)
    n_mostrado = int(n ** 1.62)  # exagero cômico
    cont = texto(f"F5 ×{n_mostrado}", "black", 150, RED if n > 12 else INK)
    put(fr, cont, W / 2, 290, escala=1 + 0.12 * aperto)
    # legenda
    if t > 0.12:
        leg = texto("você, às 3h47 da manhã:", "mono", 40, (170, 170, 170))
        put(fr, leg, W / 2, H - 300, alpha=out_cubic(p(t, 0.12, 0.4)))
        rel = texto("03:47", "black", 96, (60, 60, 60))
        put(fr, rel, W / 2, H - 200)
    # barra de carregamento que nunca termina
    prog = (t * 1.7) % 1
    d.rounded_rectangle([140, H - 120, W - 140, H - 104], radius=8, fill=(30, 30, 30))
    d.rounded_rectangle([140, H - 120, 140 + int((W - 280) * min(0.97, prog)), H - 104], radius=8, fill=EM)


def cena_ansiedade(fr, t):
    for i, (pal, cor) in enumerate(PALAVRAS):
        st = SLAMS[i]
        if t < st:
            break
        rr = random.Random(i * 97 + 5)
        x = rr.randint(240, W - 240)
        y = rr.randint(260, H - 260)
        rot = rr.uniform(-18, 18)
        tam = 150 if len(pal) < 6 else (118 if len(pal) < 11 else 96)
        largura = texto(pal, "black", tam, cor, 6, (0, 0, 0)).width * math.cos(math.radians(abs(rot)))
        x = clamp(x, largura / 2 + 30, W - largura / 2 - 30) if largura < W - 60 else W / 2
        k = p(t, st, st + 0.16)
        esc = lerp(2.4, 1.0, out_expo(k))
        jit = 6 * math.sin(t * 90 + i)
        put(fr, texto(pal, "black", tam, cor, 6, (0, 0, 0)), x + jit, y, escala=esc, rot=rot, alpha=min(1, k * 3))
    # relógio pulsando com o coração
    bat = max([b for b in BATIMENTOS if b <= t], default=-9)
    pulso = math.exp(-12 * max(0, t - bat))
    put(fr, texto("03:47", "black", 220, (90, 20, 20)), W / 2, H / 2, escala=1 + 0.08 * pulso, alpha=0.55)


def cena_digitar(fr, t):
    y = H / 2 - 60
    for frase, inicio in DIGITAR:
        n = int(clamp((t - inicio) / 0.045, 0, len(frase)))
        if n > 0:
            tx = texto(frase[:n], "mono", 64, EM if frase.startswith("> deixa") else INK)
            fr.paste(tx, (150, int(y)), tx)
        y += 110
    if int(t * 4) % 2 == 0:
        ImageDraw.Draw(fr).rectangle([150, y + 6, 182, y + 76], fill=EM)


def cena_logo(fr, t):
    lt = t - LOGO_T
    cx, cy = W / 2, H / 2 - 160
    # ondas
    for i in range(4):
        k = p(lt, 0.1 + i * 0.18, 1.3 + i * 0.18)
        if 0 < k < 1:
            r = lerp(120, 620, out_cubic(k))
            a = int(200 * (1 - k))
            ImageDraw.Draw(fr, "RGBA").ellipse([cx - r, cy - r, cx + r, cy + r], outline=EM + (a,), width=6)
    # sino balançando
    esc = spring(p(lt, 0, 0.9), k=9, d=4.5)
    rot = 28 * math.exp(-3.2 * max(0, lt - 0.15)) * math.sin(lt * 18) if lt > 0.15 else 0
    put(fr, sino(300, EM), cx, cy, escala=max(0.01, esc), rot=rot)
    # letreiro letra a letra
    x = W / 2 - F("black", 150).getlength("Notifica.ai") / 2
    for i, ch in enumerate("Notifica.ai"):
        k = p(lt, 0.45 + i * 0.045, 0.85 + i * 0.045)
        cor = EM if i >= 8 else INK
        im = letra(ch, "black", 150, cor)
        dy = lerp(-120, 0, out_back(k)) if k > 0 else -120
        put(fr, im, x + im.width / 2 - 6, H / 2 + 170 + dy, alpha=min(1, k * 2))
        x += F("black", 150).getlength(ch)
    tag = texto("Pare de atualizar a página.", "semi", 46, (190, 190, 190))
    put(fr, tag, W / 2, H / 2 + 330, alpha=out_cubic(p(lt, 1.1, 1.5)))
    tag2 = texto("A gente te avisa.", "bold", 46, EM)
    put(fr, tag2, W / 2, H / 2 + 395, alpha=out_cubic(p(lt, 1.3, 1.7)))


def cena_pov(fr, t):
    lt = t - POV_T
    # edital rolando no fundo, com a linha de leitura
    doc = documento()
    off = int(lt * 900) % (doc.height - H)
    recorte = doc.crop((0, off, W, off + H))
    fr.paste(recorte, (0, 0), recorte)
    scan_y = int(400 + (lt * 1300) % (H - 500))
    d = ImageDraw.Draw(fr, "RGBA")
    d.rectangle([0, scan_y - 2, W, scan_y + 2], fill=EM + (220,))
    d.rectangle([0, scan_y - 50, W, scan_y], fill=EM + (25,))
    # topo: POV
    d.rectangle([0, 0, W, 330], fill=(10, 10, 10, 235))
    k = out_back(p(lt, 0, 0.35))
    pov = texto("POV: eu sou o Vigia", "black", 78, INK)
    put(fr, pov, W / 2 - 45, 120, escala=0.6 + 0.4 * k, alpha=min(1, k))
    put(fr, emoji("👀", 70), W / 2 - 45 + pov.width / 2 + 55, 118, escala=max(0.01, k))
    lidas = 12408 + int(lt * 1730)
    put(fr, texto(f"páginas lidas hoje: {lidas:,}".replace(",", "."), "mono", 36, EM), W / 2, 225, alpha=out_cubic(p(lt, 0.2, 0.5)))
    put(fr, texto("eu leio o edital de 87 páginas. você lê uma frase.", "monor", 27, (160, 160, 160)), W / 2, 285,
        alpha=out_cubic(p(lt, 0.4, 0.8)))
    # celular subindo
    kc = out_cubic(p(lt, 0.1, 0.65))
    cel_y = lerp(H + 700, 1230, kc)
    cel = celular()
    fr.paste(cel, (int(W / 2 - cel.width / 2), int(cel_y - cel.height / 2)), cel)
    # notificações caindo (a mais nova em cima, as outras descem)
    topo = cel_y - cel.height / 2 + 380
    for i, nt in enumerate(NOTIFS):
        if t < nt:
            continue
        k = spring(p(t, nt, nt + 0.55), k=12, d=6)
        recentes = sum(1 for o in NOTIFS if o > nt and t >= o)
        desloc = sum(spring(p(t, o, o + 0.55), k=12, d=6) for o in NOTIFS if o > nt and t >= o) * 236
        y = topo + 110 + desloc
        y0 = topo - 260
        card = cartao_notif(*NOTIFICACOES[i])
        put(fr, card, W / 2, lerp(y0, y, k), escala=0.85 + 0.15 * min(1, k), alpha=clamp(k * 2) * (1 - 0.12 * recentes))
        # brilho de chegada
        fl = 1 - p(t, nt, nt + 0.35)
        if fl > 0:
            r = 380 * (1 - fl) + 60
            ImageDraw.Draw(fr, "RGBA").ellipse([W / 2 - r, y - r * 0.4, W / 2 + r, y + r * 0.4], outline=EM + (int(160 * fl),), width=4)


def cena_split(fr, t):
    lt = t - SPLIT_T
    d = ImageDraw.Draw(fr, "RGBA")
    k1 = out_expo(p(lt, 0, 0.45))
    k2 = out_expo(p(lt, 0.25, 0.7))
    # metade de cima (vestibular) entra pela esquerda, de baixo (concurso) pela direita
    dx1 = lerp(-W * 1.2, 0, k1)
    dx2 = lerp(W * 1.2, 0, k2)
    d.polygon([(dx1, 0), (dx1 + W, 0), (dx1 + W, H * 0.44), (dx1, H * 0.56)], fill=(16, 32, 26, 255))
    d.polygon([(dx2, H * 0.56), (dx2 + W, H * 0.44), (dx2 + W, H), (dx2, H)], fill=(26, 18, 36, 255))
    put(fr, emoji("🎓", 130), W / 2 + dx1, 330)
    put(fr, texto("VESTIBULAR", "black", 128, EM), W / 2 + dx1, 500)
    put(fr, texto("ENEM · SISU · ProUni · lista de espera", "mono", 33, (190, 220, 205)), W / 2 + dx1, 610)
    put(fr, emoji("📚", 130), W / 2 + dx2, 1260)
    put(fr, texto("CONCURSO", "black", 128, PURPLE), W / 2 + dx2, 1430)
    put(fr, texto("edital · retificação · gabarito · posse", "mono", 33, (215, 200, 235)), W / 2 + dx2, 1540)
    # "+" no meio
    km = spring(p(lt, 0.55, 1.1))
    put(fr, texto("os dois.", "black", 92, INK, 8, (0, 0, 0)), W / 2, H / 2, escala=max(0.01, km), rot=-6)


def cena_cta(fr, t):
    lt = t - CTA_T
    k = out_back(p(lt, 0, 0.35))
    put(fr, texto("Pare de dar", "black", 120, INK), W / 2, 520, escala=0.5 + 0.5 * k, alpha=min(1, k))
    # F5 riscado
    kf = spring(p(lt, 0.12, 0.6))
    put(fr, tecla("F5", 300), W / 2, 800, escala=max(0.01, kf), rot=-8)
    kr = out_cubic(p(lt, 0.45, 0.65))
    if kr > 0:
        d = ImageDraw.Draw(fr)
        x0, y0, x1, y1 = W / 2 - 200, 960, W / 2 + 200, 640
        d.line([(x0, y0), (lerp(x0, x1, kr), lerp(y0, y1, kr))], fill=RED, width=30)
    # endereço
    kp = out_back(p(lt, 0.6, 0.95))
    pill = Image.new("RGBA", (760, 150), (0, 0, 0, 0))
    ImageDraw.Draw(pill).rounded_rectangle([0, 0, 759, 149], radius=75, fill=EM + (255,))
    url = texto("notifica.dev.br", "black", 82, (0, 0, 0))
    pill.alpha_composite(url, (380 - url.width // 2, 75 - url.height // 2))
    put(fr, pill, W / 2, 1180, escala=max(0.01, 0.6 + 0.4 * kp), alpha=min(1, kp * 1.5))
    put(fr, texto("grátis pra começar · vestibular e concurso", "mono", 34, (170, 170, 170)), W / 2, 1320,
        alpha=out_cubic(p(lt, 0.9, 1.2)))
    rot = 22 * math.exp(-3 * max(0, lt - 0.7)) * math.sin(lt * 20) if lt > 0.7 else 0
    put(fr, sino(150, EM), W / 2, 1530, rot=rot, alpha=out_cubic(p(lt, 0.7, 0.9)))


# ── Composição de cada quadro ──────────────────────────────────
def quadro(i):
    t = i / FPS
    fr = (GRADE if t >= LOGO_T else Image.new("RGB", (W, H), BG)).copy()
    shake, rgb, flash, fatias = 0.0, 0, 0.0, 0

    if t < 2.6:
        cena_f5(fr, t)
        ult = max([c for c in CLIQUES if c <= t], default=-9)
        shake = 10 * math.exp(-25 * (t - ult)) * (0.4 + t / 2.6)
        rgb = int(4 + 10 * t / 2.6)
    elif t < WHITEOUT + 0.08:
        cena_ansiedade(fr, t)
        ult = max([s for s in SLAMS if s <= t], default=-9)
        shake = 26 * math.exp(-18 * (t - ult)) + 6
        rgb = int(14 + 16 * p(t, 2.6, WHITEOUT))
        fatias = 6
        flash = p(t, WHITEOUT - 0.22, WHITEOUT) ** 2
    elif t < LOGO_T:
        cena_digitar(fr, t)
    elif t < POV_T:
        cena_logo(fr, t)
        rgb = int(10 * math.exp(-6 * (t - LOGO_T)))
    elif t < SPLIT_T:
        cena_pov(fr, t)
        ult = max([n for n in NOTIFS if n <= t], default=-9)
        shake = 9 * math.exp(-20 * (t - ult))
        rgb = int(8 * math.exp(-14 * (t - ult)))
    elif t < CTA_T:
        cena_split(fr, t)
        shake = 14 * math.exp(-14 * (t - SPLIT_T)) + 10 * math.exp(-14 * max(0, t - SPLIT_T - 0.25))
        rgb = int(6 * math.exp(-8 * (t - SPLIT_T)))
    else:
        cena_cta(fr, t)
        shake = 8 * math.exp(-16 * (t - CTA_T))

    # transições: flash branco no fim da ansiedade, preto curto antes do logo
    a = np.asarray(fr).astype(np.int16)
    if shake > 0.5:
        a = np.roll(a, (int(random.uniform(-shake, shake)), int(random.uniform(-shake, shake))), axis=(0, 1))
    if fatias:
        for _ in range(fatias):
            y0 = random.randint(0, H - 80)
            hh = random.randint(10, 90)
            a[y0:y0 + hh] = np.roll(a[y0:y0 + hh], random.randint(-60, 60), axis=1)
    if rgb:
        a[..., 0] = np.roll(a[..., 0], rgb, axis=1)
        a[..., 2] = np.roll(a[..., 2], -rgb, axis=1)
    a = a * VINHETA + GRAOS[i % 4]
    if flash > 0:
        a = a * (1 - flash) + 255 * flash
    # entrada do logo: sai do branco
    if LOGO_T <= t < LOGO_T + 0.12:
        a = a + 255 * (1 - p(t, LOGO_T, LOGO_T + 0.12))
    # fade-in no comeco e sem fade no fim (vídeo em loop)
    if t < 0.12:
        a = a * p(t, 0, 0.12)
    return np.clip(a, 0, 255).astype(np.uint8)


import os
if os.environ.get("PREVIA"):
    for ts in os.environ["PREVIA"].split(","):
        Image.fromarray(quadro(int(float(ts) * FPS))).save(OUT / f"previa-{ts}.png")
    sys.exit(0)

# ── Som ────────────────────────────────────────────────────────
L = int(SR * DUR)
mixL = np.zeros(L, np.float32)
mixR = np.zeros(L, np.float32)
verb_send = np.zeros(L, np.float32)


def add(sig, t0, ganho=1.0, pan=0.0, verb=0.0):
    i0 = int(t0 * SR)
    if i0 >= L:
        return
    sig = sig[: L - i0] * ganho
    gl = math.cos((pan + 1) * math.pi / 4)
    gr = math.sin((pan + 1) * math.pi / 4)
    mixL[i0:i0 + len(sig)] += sig * gl
    mixR[i0:i0 + len(sig)] += sig * gr
    if verb:
        verb_send[i0:i0 + len(sig)] += sig * verb


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def env(dur, decay, attack=0.002):
    x = tt(dur)
    return np.minimum(1, x / attack) * np.exp(-x / decay)


def ruido(dur):
    return rng.uniform(-1, 1, int(dur * SR)).astype(np.float32)


def passa_baixa(x, corte):
    """um polo; corte pode variar no tempo (array)"""
    corte = np.broadcast_to(np.asarray(corte, np.float32), x.shape)
    a = 1 - np.exp(-2 * np.pi * corte / SR)
    y = np.empty_like(x)
    acc = 0.0
    for n in range(len(x)):
        acc += a[n] * (x[n] - acc)
        y[n] = acc
    return y


def passa_alta(x):
    return np.diff(x, prepend=0).astype(np.float32)


def kick(dur=0.45):
    x = tt(dur)
    f = 45 + 120 * np.exp(-x / 0.035)
    fase = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(fase) * env(dur, 0.16) + 0.4 * ruido(dur) * env(dur, 0.004)).astype(np.float32)


def snare(dur=0.3):
    x = tt(dur)
    return (0.7 * passa_alta(ruido(dur)) * env(dur, 0.07) + 0.4 * np.sin(2 * np.pi * 190 * x) * env(dur, 0.05)).astype(np.float32)


def hat(dur=0.06):
    return (passa_alta(passa_alta(ruido(dur))) * env(dur, 0.012) * 0.6).astype(np.float32)


def clique(tom):
    dur = 0.05
    x = tt(dur)
    return (passa_alta(ruido(dur)) * env(dur, 0.006) * 0.9 + 0.5 * np.sin(2 * np.pi * tom * x) * env(dur, 0.01)).astype(np.float32)


def slam():
    dur = 0.5
    x = tt(dur)
    corpo = np.sin(2 * np.pi * (55 + 60 * np.exp(-x / 0.03)) * x) * env(dur, 0.18)
    crunch = np.round(ruido(dur) * 4) / 4 * env(dur, 0.06)  # bitcrush
    return (corpo + 0.6 * crunch).astype(np.float32)


def coracao():
    def thump(f):
        dur = 0.22
        x = tt(dur)
        return np.sin(2 * np.pi * f * x) * env(dur, 0.06, 0.01)
    s = np.zeros(int(0.45 * SR), np.float32)
    a = thump(58)
    b = thump(50) * 0.8
    s[: len(a)] += a
    s[int(0.17 * SR): int(0.17 * SR) + len(b)] += b
    return s


def sino_som(f0, dur=2.6, brilho=1.0):
    x = tt(dur)
    parciais = [(1, 1, 1.4), (2.0, 0.5, 0.9), (2.76, 0.35 * brilho, 0.6), (5.4, 0.18 * brilho, 0.3), (8.93, 0.08 * brilho, 0.18)]
    s = sum(a * np.sin(2 * np.pi * f0 * r * x) * np.exp(-x / d) for r, a, d in parciais)
    return (s * np.minimum(1, x / 0.003) * 0.5).astype(np.float32)


def plim():
    """notificação: duas notas"""
    a = sino_som(1318.5, 0.6, 0.6) * 0.8
    b = sino_som(1975.5, 0.9, 0.6)
    s = np.zeros(int(1.0 * SR), np.float32)
    s[: len(a)] += a
    o = int(0.09 * SR)
    s[o:o + len(b)] += b
    return s


def whoosh(dur=0.6, sobe=True):
    x = tt(dur)
    k = x / dur
    corte = (300 + 6000 * (k if sobe else 1 - k)).astype(np.float32)
    s = passa_baixa(ruido(dur), corte)
    return (s * np.sin(np.pi * k) ** 2 * 2.2).astype(np.float32)


def sub_drop(dur=1.2):
    x = tt(dur)
    f = 30 + 60 * np.exp(-x / 0.25)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * env(dur, 0.5, 0.005)).astype(np.float32)


def baixo(f, dur=0.45):
    x = tt(dur)
    s = np.sin(2 * np.pi * f * x) + 0.35 * np.sin(4 * np.pi * f * x) + 0.12 * np.sin(6 * np.pi * f * x)
    return (s * env(dur, 0.18, 0.004) * 0.6).astype(np.float32)


def riser(dur):
    x = tt(dur)
    k = x / dur
    f = 120 + 900 * k ** 2
    tom = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    ru = passa_baixa(ruido(dur), (400 + 7000 * k ** 2).astype(np.float32)) * 1.5
    return ((tom + ru) * k ** 1.5).astype(np.float32)


def drone(dur):
    """tensão grave do começo"""
    x = tt(dur)
    s = sum(np.sign(np.sin(2 * np.pi * f * x)) * 0.08 for f in (55, 55.6, 82.4, 110.7))
    s = passa_baixa(s.astype(np.float32), 600)
    return (s * np.minimum(1, x / 0.3)).astype(np.float32)


print("som…", flush=True)
# 1) F5: drone + cliques + tique-taque
add(drone(4.3), 0.0, 0.9)
for i, c in enumerate(CLIQUES):
    add(clique(2400 + 300 * random.random()), c, 0.55, pan=random.uniform(-0.6, 0.6))
for k in range(0, 9):
    add(clique(5200) * 0.4, 0.05 + k * 0.5, 0.35, pan=0.7 if k % 2 else -0.7)
# 2) ansiedade: coração, impactos, riser, flash
for b in BATIMENTOS:
    add(coracao(), b, 1.0)
for i, s in enumerate(SLAMS):
    add(slam(), s, 0.75, pan=random.uniform(-0.5, 0.5))
add(riser(WHITEOUT - 2.6), 2.6, 0.8)
add(kick(), WHITEOUT - 0.02, 1.0)
add(whoosh(0.35, True), WHITEOUT - 0.3, 0.6)
# 3) silêncio: teclas do Vigia
for frase, inicio in DIGITAR:
    for j in range(len(frase)):
        add(clique(3600) * 0.6, inicio + j * 0.045, 0.35, pan=0.2)
# 4) logo: sino + sub
add(sub_drop(), LOGO_T, 0.9)
add(sino_som(659.3, 3.0), LOGO_T + 0.05, 0.55, verb=0.5)
add(sino_som(987.8, 2.5), LOGO_T + 0.17, 0.35, pan=0.3, verb=0.5)
add(whoosh(0.5, False), LOGO_T, 0.4)
# 5–7) batida a 120 bpm
padrao_baixo = [55.0, 55.0, 43.65, 49.0]  # Lá, Lá, Fá, Sol
tb = BPM_INICIO
k = 0
while tb < CTA_T + 1.0:
    add(kick(), tb, 0.85)
    if k % 2 == 1:
        add(snare(), tb, 0.45, verb=0.2)
    add(hat(), tb + BATIDA / 2, 0.35, pan=0.4)
    add(baixo(padrao_baixo[(k // 2) % 4]), tb, 0.8)
    tb += BATIDA
    k += 1
for n in NOTIFS:
    add(plim(), n, 0.5, verb=0.35)
    add(whoosh(0.3, True), n - 0.25, 0.3)
add(whoosh(0.5, True), SPLIT_T - 0.2, 0.7, pan=-0.5)
add(whoosh(0.5, False), SPLIT_T + 0.1, 0.7, pan=0.5)
add(slam(), SPLIT_T + 0.55, 0.5)
# CTA: risco no F5 e acorde final
add(whoosh(0.25, True), CTA_T + 0.45, 0.5)
add(slam(), CTA_T + 0.6, 0.6)
for f, d_ in [(440.0, 0), (554.4, 0.03), (659.3, 0.06), (880.0, 0.09)]:
    add(sino_som(f, 2.0), CTA_T + 0.75 + d_, 0.22, verb=0.6)
add(sub_drop(1.0), CTA_T + 0.6, 0.7)

# reverb simples: convolução com ruído decaindo
ir_len = int(1.4 * SR)
ir = (rng.uniform(-1, 1, ir_len) * np.exp(-np.arange(ir_len) / (0.35 * SR))).astype(np.float32) * 0.03
n_fft = 1 << int(np.ceil(np.log2(L + ir_len)))
cauda = np.fft.irfft(np.fft.rfft(verb_send, n_fft) * np.fft.rfft(ir, n_fft), n_fft)[:L].astype(np.float32)
mixL += cauda
mixR += np.roll(cauda, int(0.011 * SR))  # leve abertura estéreo

est = np.stack([mixL, mixR], axis=1)
est = np.tanh(est * 1.4) / np.tanh(1.4)  # saturação suave
est *= 0.89 / max(1e-6, np.abs(est).max())  # pico em -1 dB
# fade de 15 ms no fim (sem estalo no loop)
fim = int(0.015 * SR)
est[-fim:] *= np.linspace(1, 0, fim)[:, None]
pcm = (est * 32767).astype(np.int16)
with wave.open(str(OUT / "som.wav"), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())

# ── Vídeo ──────────────────────────────────────────────────────
print("quadros…", flush=True)
ff = subprocess.Popen([
    "ffmpeg", "-y", "-loglevel", "error",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
    "-i", str(OUT / "som.wav"),
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest",
    str(OUT / "notifica-motion-1080x1920.mp4"),
], stdin=subprocess.PIPE)
for i in range(N):
    ff.stdin.write(quadro(i).tobytes())
    if i % 45 == 0:
        print(f"  {i}/{N}", flush=True)
ff.stdin.close()
ff.wait()
print("pronto:", OUT / "notifica-motion-1080x1920.mp4")
