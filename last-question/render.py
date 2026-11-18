#!/usr/bin/env python3
"""《最后的问题》—— 纯代码演绎短片（16:9，1920x1080）

致敬艾萨克·阿西莫夫短篇小说《最后的问题》(1956)。
画面、音乐、文字全部由本脚本生成；所有旁白均为原创改写，未引用原文。

依赖：Python 3、NumPy、Pillow、FFmpeg、文泉驿正黑字体。
用法：python3 render.py [输出路径] [--preview 秒]
"""
import math
import os
import subprocess
import sys
import wave
from functools import lru_cache
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1920, 1080
FPS = 24
SR = 44100
FONT_PATH = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"

# ----------------------------------------------------------------------------
# 时间线
# ----------------------------------------------------------------------------
SCENES = [  # (名字, 开始, 结束)
    ("title", 0, 9),
    ("earth", 9, 29),
    ("warp", 29, 48),
    ("galaxy", 48, 67),
    ("cosmos", 67, 86),
    ("merge", 86, 102),
    ("dark", 102, 119),
    ("bang", 119, 131),
    ("credits", 131, 141),
]
DURATION = SCENES[-1][2]

REPLY = "> 数据不足，尚无法作答。"

# kind: era / narr / q / reply / center / big / title / credit
TEXTS = [
    # 片头
    dict(k="title", t0=1.5, t1=8.3, s="最后的问题"),
    dict(k="subtitle", t0=2.8, t1=8.3, s="THE LAST QUESTION · 一次纯代码演绎"),
    dict(k="credit_small", t0=4.0, t1=8.3, s="致敬 艾萨克·阿西莫夫", y=760),
    # 第一问
    dict(k="era", t0=9.6, t1=28.4, s="公元 2061 年 · 地球", sub="第一问 / MULTIVAC"),
    dict(k="narr", t0=10.6, t1=17.6, s="人类第一次学会直接汲取太阳的能量。", line=0),
    dict(k="narr", t0=11.8, t1=17.6, s="一个微醺的夜晚，两位技术员向 Multivac 抛出了一个赌注般的问题——", line=1),
    dict(k="q", t0=18.2, t1=28.4, s="“宇宙的熵，可以被逆转吗？”"),
    dict(k="reply", t0=21.6, t1=28.4, s=REPLY),
    # 第二问
    dict(k="era", t0=29.6, t1=47.4, s="约一万年后 · 星际时代", sub="第二问 / MICROVAC"),
    dict(k="narr", t0=30.6, t1=37.2, s="超空间跃迁让人类散布到银河的各个角落。", line=0),
    dict(k="narr", t0=31.8, t1=37.2, s="一家人驾驶星舰飞往新的行星。孩子们听说：星星总有一天会熄灭。", line=1),
    dict(k="q", t0=37.8, t1=47.4, s="“能让死去的恒星重新燃烧吗？”"),
    dict(k="reply", t0=41.0, t1=47.4, s=REPLY),
    # 第三问
    dict(k="era", t0=48.6, t1=66.4, s="约一百万年后 · 银河", sub="第三问 / GALACTIC AC"),
    dict(k="narr", t0=49.6, t1=56.2, s="人类获得了永生，银河却即将被填满。", line=0),
    dict(k="narr", t0=50.8, t1=56.2, s="银河计算机隐身于超空间，没有人知道它真正在哪里。", line=1),
    dict(k="q", t0=56.8, t1=66.4, s="“群星终将燃尽——熵，能否回头？”"),
    dict(k="reply", t0=60.0, t1=66.4, s=REPLY),
    # 第四问
    dict(k="era", t0=67.6, t1=85.4, s="数十亿年后 · 宇宙", sub="第四问 / UNIVERSAL AC"),
    dict(k="narr", t0=68.6, t1=75.2, s="心智脱离了肉身，像光一样在星系之间漫游。", line=0),
    dict(k="narr", t0=69.8, t1=75.2, s="恒星一颗接一颗地暗去，宇宙正在缓慢地冷却。", line=1),
    dict(k="q", t0=75.8, t1=85.4, s="“我们，还能让群星复燃吗？”"),
    dict(k="reply", t0=79.0, t1=85.4, s=REPLY),
    # 融合
    dict(k="era", t0=86.6, t1=101.4, s="万亿年后 · 时间的尽头", sub="最后的融合 / AC"),
    dict(k="narr", t0=87.6, t1=94.4, s="最后的星光散尽。人类所有的心智，汇入了那台计算机。", line=0),
    dict(k="narr", t0=88.8, t1=94.4, s="物质与能量都走到了终点，只剩一个问题悬而未决。", line=1),
    dict(k="reply_c", t0=95.4, t1=101.4, s="> 仍在收集数据……"),
    # 黑暗
    dict(k="center", t0=102.6, t1=105.8, s="在没有时间、也没有空间的地方，它继续思考。"),
    dict(k="center", t0=106.2, t1=109.4, s="终于，它明白了如何逆转熵。"),
    dict(k="center", t0=109.8, t1=113.0, s="可是，已经没有谁可以听到这个答案。"),
    dict(k="center", t0=113.4, t1=116.2, s="于是，它决定亲自演示。"),
    dict(k="big", t0=116.4, t1=119.15, s="要有光——"),
    # 大爆炸
    dict(k="center_low", t0=125.2, t1=130.4, s="于是，有了光。"),
    # 片尾
    dict(k="credit_title", t0=131.8, t1=140.4, s="最后的问题"),
    dict(k="credit_small", t0=132.6, t1=140.4, s="灵感来自艾萨克·阿西莫夫短篇小说《最后的问题》（1956）", y=600),
    dict(k="credit_small", t0=133.2, t1=140.4, s="画面、音乐与文字均由代码生成 · 旁白为原创改写的演绎", y=660),
    dict(k="credit_tiny", t0=133.8, t1=140.4, s="Python · NumPy · Pillow · FFmpeg", y=740),
]

TYPE_CPS = {"reply": 9.0, "reply_c": 7.0, "big": 2.4}
TYPE_DELAY = {"reply": 0.0, "reply_c": 0.0, "big": 0.3}


# ----------------------------------------------------------------------------
# 工具
# ----------------------------------------------------------------------------
def clamp01(x):
    return max(0.0, min(1.0, x))


def smooth(x):
    x = clamp01(x)
    return x * x * (3 - 2 * x)


def env(t, a, b, fin=1.0, fout=1.0):
    return smooth((t - a) / fin) * smooth((b - t) / fout)


@lru_cache(None)
def font(size, idx=0):
    return ImageFont.truetype(FONT_PATH, size, index=idx)


def splat(img, xs, ys, cols):
    """把点以加法方式画到图像上（带亚像素双线性分配）。"""
    h, w, _ = img.shape
    m = (xs >= 0) & (xs < w - 1) & (ys >= 0) & (ys < h - 1)
    xs, ys, cols = xs[m], ys[m], cols[m]
    if xs.size == 0:
        return
    x0 = xs.astype(np.int32)
    y0 = ys.astype(np.int32)
    fx = (xs - x0)[:, None]
    fy = (ys - y0)[:, None]
    flat = img.reshape(-1, 3)
    for dx, dy, wgt in ((0, 0, (1 - fx) * (1 - fy)), (1, 0, fx * (1 - fy)),
                        (0, 1, (1 - fx) * fy), (1, 1, fx * fy)):
        np.add.at(flat, (y0 + dy) * w + (x0 + dx), cols * wgt)


def blur(buf, radius):
    """对 float 图像做高斯模糊（借助 Pillow，按通道处理以保留精度）。"""
    # 三次盒式模糊近似高斯（在低分辨率缓冲上进行，开销很小）
    r = max(1, int(round(radius * 0.9)))
    out = buf
    for _ in range(3):
        for ax in (0, 1):
            pad = [(0, 0)] * 3
            pad[ax] = (r + 1, r)
            c = np.cumsum(np.pad(out, pad, mode="constant"), axis=ax, dtype=np.float32)
            n = out.shape[ax]
            out = (np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=ax)
                   - np.take(c, np.arange(0, n), axis=ax)) / (2 * r + 1)
    return out


def upscale(buf, w=W, h=H):
    out = np.empty((h, w, 3), np.float32)
    for c in range(3):
        im = Image.fromarray(buf[:, :, c].astype(np.float32), mode="F")
        out[:, :, c] = np.asarray(im.resize((w, h), Image.BILINEAR))
    return out


def add_glow(img, xs, ys, cols, radius=6, scale=4):
    g = np.zeros((H // scale, W // scale, 3), np.float32)
    splat(g, xs / scale, ys / scale, cols)
    img += upscale(blur(g, radius / scale * 2))


# ----------------------------------------------------------------------------
# 预计算资源（每个进程一次）
# ----------------------------------------------------------------------------
R = {}


def init_resources():
    if R:
        return
    rng = np.random.default_rng(1956)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    R["yy"], R["xx"] = yy, xx

    # 背景星
    n = 2200
    R["sx"] = rng.uniform(0, W, n).astype(np.float32)
    R["sy"] = rng.uniform(0, H, n).astype(np.float32)
    R["sb"] = (rng.power(6, n) * 0.0 + rng.uniform(0, 1, n) ** 4).astype(np.float32)
    R["sph"] = rng.uniform(0, 2 * np.pi, n).astype(np.float32)
    R["sfreq"] = rng.uniform(0.5, 2.5, n).astype(np.float32)
    temp = rng.uniform(0, 1, n)
    R["scol"] = np.stack([0.8 + 0.2 * temp, 0.85 + 0.1 * temp, 1.0 - 0.25 * temp], 1).astype(np.float32)

    # 地球场景：太阳与行星
    d_sun = np.hypot(xx - 300, yy - 260)
    R["sun"] = (np.exp(-d_sun / 70)[..., None] * np.array([1.6, 1.3, 0.8])
                + np.exp(-d_sun / 380)[..., None] * np.array([0.35, 0.22, 0.10])).astype(np.float32)
    cx, cy, rad = W * 0.45, H + 1650, 1900
    d = np.hypot(xx - cx, yy - cy)
    inside = d < rad
    # 球面明暗（光从左上方来）
    nx = (xx - cx) / rad
    ny = (yy - cy) / rad
    lam = np.clip(-nx * 0.55 - ny * 0.75, 0, 1)
    noise = np.sin(xx * 0.011 + np.sin(yy * 0.03) * 2) * np.sin(yy * 0.05 + xx * 0.004)
    land = (noise > 0.25).astype(np.float32)
    base = np.stack([0.04 + 0.10 * land, 0.10 + 0.14 * land, 0.28 - 0.12 * land], -1)
    earth = base * (0.15 + 1.2 * lam)[..., None] * inside[..., None]
    rim = np.exp(-np.abs(d - rad) / 14) * (0.4 + lam * 1.4)
    earth += rim[..., None] * np.array([0.25, 0.55, 1.1])
    R["earth"] = earth.astype(np.float32)
    R["earth_mask"] = inside.astype(np.float32)

    # Multivac 指示灯阵列
    gx, gy = np.meshgrid(np.arange(26), np.arange(14))
    R["mv_x"] = (1180 + gx.ravel() * 24).astype(np.float32)
    R["mv_y"] = (170 + gy.ravel() * 24).astype(np.float32)
    R["mv_ph"] = rng.uniform(0, 1, gx.size).astype(np.float32)
    R["mv_rate"] = rng.uniform(0.6, 3.5, gx.size).astype(np.float32)
    R["mv_col"] = rng.choice(np.array([[1.0, 0.55, 0.15], [0.3, 1.0, 0.5], [0.4, 0.7, 1.0]], np.float32),
                             gx.size, p=[0.55, 0.3, 0.15])

    # 跃迁星流
    m = 2600
    R["wx"] = rng.uniform(-1, 1, m).astype(np.float32)
    R["wy"] = rng.uniform(-1, 1, m).astype(np.float32)
    R["wz"] = rng.uniform(0.02, 1, m).astype(np.float32)
    R["wcol"] = np.stack([rng.uniform(0.6, 1, m), rng.uniform(0.75, 1, m), np.ones(m)], 1).astype(np.float32)

    # 银河
    g = 60000
    arms = 4
    arm = rng.integers(0, arms, g)
    r = rng.exponential(0.32, g).clip(0.02, 1.25)
    theta = arm * 2 * np.pi / arms + np.log(r + 0.05) * 2.4 + rng.normal(0, 0.28, g) * (0.4 + r)
    bulge = rng.uniform(0, 1, g) < 0.22
    r[bulge] = np.abs(rng.normal(0, 0.12, bulge.sum()))
    theta[bulge] = rng.uniform(0, 2 * np.pi, bulge.sum())
    R["gr"], R["gth"] = r.astype(np.float32), theta.astype(np.float32)
    R["gz"] = (rng.normal(0, 0.03, g) * np.exp(-r)).astype(np.float32)
    core = np.exp(-r / 0.18)
    gcol = np.stack([0.55 + 0.45 * core, 0.6 + 0.3 * core, 1.0 - 0.45 * core], 1)
    hii = rng.uniform(0, 1, g) < 0.025
    gcol[hii] = [1.0, 0.45, 0.65]
    R["gcol"] = (gcol * rng.uniform(0.3, 1.0, g)[:, None]).astype(np.float32)

    # 宇宙：许多星系
    k = 46
    R["cx"] = rng.uniform(80, W - 80, k).astype(np.float32)
    R["cy"] = rng.uniform(80, H - 80, k).astype(np.float32)
    R["csz"] = rng.uniform(14, 70, k).astype(np.float32)
    R["cang"] = rng.uniform(0, np.pi, k).astype(np.float32)
    R["ctilt"] = rng.uniform(0.25, 1, k).astype(np.float32)
    R["cdie"] = rng.uniform(0.15, 0.95, k).astype(np.float32)  # 熄灭时刻（场景比例）
    per = 900
    R["cpr"] = rng.exponential(0.35, (k, per)).clip(0, 1.2).astype(np.float32)
    R["cpt"] = (np.log(R["cpr"] + 0.05) * 2.2 + rng.integers(0, 2, (k, per)) * np.pi
                + rng.normal(0, 0.35, (k, per))).astype(np.float32)

    # 融合：向中心汇聚的光点
    q = 9000
    R["mr"] = rng.uniform(0.05, 1.0, q).astype(np.float32) ** 0.6
    R["mth"] = rng.uniform(0, 2 * np.pi, q).astype(np.float32)
    R["mspd"] = rng.uniform(0.6, 1.4, q).astype(np.float32)
    hue = rng.uniform(0, 1, q)
    R["mcol"] = np.stack([0.6 + 0.4 * np.cos(hue * 6.28), 0.6 + 0.4 * np.cos(hue * 6.28 - 2.1),
                          0.8 + 0.2 * np.cos(hue * 6.28 - 4.2)], 1).astype(np.float32)

    # 大爆炸
    b = 70000
    u = rng.normal(0, 1, (b, 3))
    u /= np.linalg.norm(u, axis=1, keepdims=True)
    R["bdir"] = u.astype(np.float32)
    R["bspd"] = (rng.uniform(0, 1, b) ** 0.6).astype(np.float32)
    hue = rng.uniform(0, 1, b)
    R["bcol"] = np.stack([0.75 + 0.25 * np.cos(hue * 6.28), 0.6 + 0.35 * np.cos(hue * 6.28 - 2.1),
                          0.75 + 0.25 * np.cos(hue * 6.28 - 4.2)], 1).astype(np.float32)
    # 用于大爆炸后形成“纤维状”结构的扰动
    R["bwob"] = rng.uniform(0, 2 * np.pi, (b, 2)).astype(np.float32)


# ----------------------------------------------------------------------------
# 场景绘制（t 为场景内时间，d 为场景时长；在 img 上加法绘制）
# ----------------------------------------------------------------------------
def draw_stars(img, t, gain=1.0, drift=0.0):
    tw = 0.65 + 0.35 * np.sin(R["sph"] + t * R["sfreq"] * 2)
    b = R["sb"] * tw * gain
    xs = (R["sx"] + drift * t * (0.3 + R["sb"])) % W
    cols = R["scol"] * b[:, None] * 1.6
    splat(img, xs, R["sy"], cols)
    bright = R["sb"] > 0.75
    add_glow(img, xs[bright], R["sy"][bright], cols[bright] * 8, radius=4)


def scene_title(img, t, d):
    draw_stars(img, t + 3, gain=1.0, drift=4)
    # 一缕淡淡的星云
    xx, yy = R["xx"], R["yy"]
    neb = np.exp(-(((xx - W / 2) / 900) ** 2 + ((yy - H / 2 - 40) / 260) ** 2))
    img += neb[..., None] * np.array([0.05, 0.06, 0.12], np.float32) * (0.8 + 0.2 * math.sin(t))


def scene_earth(img, t, d):
    draw_stars(img, t, gain=0.7)
    pulse = 1 + 0.04 * math.sin(t * 2.2)
    img += R["sun"] * pulse
    img *= 1 - R["earth_mask"][..., None]  # 地球遮挡背后的星
    img += R["earth"]
    # 夜面城市灯光（太阳能时代的电网）
    rng = np.random.default_rng(7)
    n = 1400
    ex = rng.uniform(900, 1900, n)
    cx, cy, rad = W * 0.45, H + 1650, 1900
    ey = cy - np.sqrt(np.maximum(rad ** 2 - (ex - cx) ** 2, 0)) + rng.exponential(60, n) + 8
    flick = 0.6 + 0.4 * np.sin(rng.uniform(0, 6.28, n) + t * rng.uniform(1, 4, n))
    cols = np.array([1.0, 0.7, 0.3], np.float32) * (flick * 0.5)[:, None]
    splat(img, ex.astype(np.float32), ey.astype(np.float32), cols.astype(np.float32))
    # Multivac：巨大的指示灯墙
    x0, y0, x1, y1 = 1160, 150, 1800, 500
    img[y0:y1, x0:x1] *= 0.15
    img[y0:y1, x0:x1] += np.array([0.02, 0.025, 0.035], np.float32)
    img[y0:y0 + 2, x0:x1] += 0.25
    img[y1 - 2:y1, x0:x1] += 0.25
    img[y0:y1, x0:x0 + 2] += 0.25
    img[y0:y1, x1 - 2:x1] += 0.25
    activity = 1.0 + 2.5 * smooth((t - 12.6) / 0.5) * smooth((19.4 - t) / 2)  # 提问后加速运算
    on = (np.sin((R["mv_ph"] + t * R["mv_rate"] * activity) * 2 * np.pi) > 0.1).astype(np.float32)
    cols = R["mv_col"] * on[:, None] * 0.9
    for dx in range(-3, 4):
        for dy in range(-3, 4):
            splat(img, R["mv_x"] + dx, R["mv_y"] + dy, cols * 0.5)
    add_glow(img, R["mv_x"], R["mv_y"], cols * 12, radius=8)


def scene_warp(img, t, d):
    speed = 0.12 + 0.5 * smooth(t / 4) - 0.35 * smooth((t - 10) / 4)
    z = (R["wz"] - t * speed * 0.6) % 1.0 + 0.02
    zt = z + speed * 0.22  # 尾迹端点
    f = 650
    cx, cy = W / 2 + 60 * math.sin(t * 0.3), H / 2 + 30 * math.sin(t * 0.21)
    cols = R["wcol"] * (np.clip(1.2 - z, 0, 1) ** 2)[:, None]
    for s in np.linspace(0, 1, 24):
        zz = z + (zt - z) * s
        xs = cx + R["wx"] * f / zz
        ys = cy + R["wy"] * f / zz
        splat(img, xs.astype(np.float32), ys.astype(np.float32), cols * (1 - s) * 0.7)
    xs = cx + R["wx"] * f / z
    ys = cy + R["wy"] * f / z
    add_glow(img, xs, ys, cols * 6, radius=5)
    # 远方目的地恒星
    dd = np.hypot(R["xx"] - cx, R["yy"] - cy)
    img += (np.exp(-dd / (18 + 6 * smooth(t / d))) * 1.2)[..., None] * np.array([0.9, 0.8, 1.0], np.float32)
    # 星舰剪影
    sx, sy = W * 0.5 + 90 * math.sin(t * 0.4), H * 0.62 + 18 * math.sin(t * 0.9)
    pts = [(sx - 140, sy + 10), (sx + 120, sy), (sx - 140, sy - 10), (sx - 115, sy)]
    ship = Image.new("L", (W, H), 0)
    ImageDraw.Draw(ship).polygon(pts, fill=255)
    m = np.asarray(ship, np.float32)[..., None] / 255
    img *= 1 - m
    img += m * np.array([0.05, 0.06, 0.09], np.float32)
    rim = Image.new("L", (W, H), 0)
    ImageDraw.Draw(rim).line(pts[:3], fill=255, width=2)
    img += np.asarray(rim, np.float32)[..., None] / 255 * np.array([0.35, 0.45, 0.7], np.float32)
    # 引擎光
    ex = np.array([sx - 142.0], np.float32)
    ey = np.array([sy], np.float32)
    flick = 1 + 0.2 * math.sin(t * 30)
    add_glow(img, ex, ey, np.array([[60, 90, 160]], np.float32) * flick, radius=14)
    add_glow(img, ex, ey, np.array([[300, 300, 300]], np.float32) * flick, radius=3)


def galaxy_points(t, cx, cy, scale, tilt, rot, gain=1.0):
    r = R["gr"]
    th = R["gth"] + rot - t * 0.25 / np.sqrt(r + 0.08)
    x = r * np.cos(th)
    y = r * np.sin(th)
    xs = cx + x * scale
    ys = cy + (y * tilt + R["gz"]) * scale
    return xs.astype(np.float32), ys.astype(np.float32), R["gcol"] * gain


def scene_galaxy(img, t, d):
    draw_stars(img, t, gain=0.4)
    scale = 520 + 60 * t / d
    xs, ys, cols = galaxy_points(t, W / 2, H / 2 - 40, scale, 0.42 + 0.06 * math.sin(t * 0.1), 0.3)
    splat(img, xs, ys, cols * 0.55)
    add_glow(img, xs, ys, cols * 0.5, radius=10)
    dd = np.hypot((R["xx"] - W / 2) / 1.0, (R["yy"] - H / 2 + 40) / 0.45)
    img += (np.exp(-dd / 60) * 0.9 + np.exp(-dd / 260) * 0.12)[..., None] * np.array([1.0, 0.85, 0.6], np.float32)
    # 被殖民的星系：越来越多的人造光点
    fill = clamp01(t / (d * 0.8))
    n = int(60000 * fill)
    rng = np.random.default_rng(3)
    idx = rng.permutation(60000)[:n]
    blink = 0.5 + 0.5 * np.sin(idx * 0.37 + t * 3)
    c = np.array([0.4, 1.0, 0.8], np.float32) * (blink[:, None] * 0.08)
    if n:
        splat(img, xs[idx], ys[idx], c.astype(np.float32))


def scene_cosmos(img, t, d):
    p = t / d
    draw_stars(img, t, gain=0.25 * (1 - p))
    k = R["cx"].size
    xs_all, ys_all, cols_all = [], [], []
    for i in range(k):
        alive = smooth((R["cdie"][i] - p) / 0.08)
        if alive <= 0.002:
            continue
        redd = clamp01(p / R["cdie"][i])
        r = R["cpr"][i]
        th = R["cpt"][i] - t * 0.3 / np.sqrt(r + 0.1)
        x, y = r * np.cos(th), r * np.sin(th) * R["ctilt"][i]
        ca, sa = math.cos(R["cang"][i]), math.sin(R["cang"][i])
        s = R["csz"][i] * (1 + 0.15 * p)
        xs_all.append(R["cx"][i] + (x * ca - y * sa) * s)
        ys_all.append(R["cy"][i] + (x * sa + y * ca) * s)
        col = np.array([0.7 + 0.3 * redd, 0.75 - 0.4 * redd, 1.0 - 0.8 * redd], np.float32)
        cols_all.append(np.tile(col * alive * 0.45, (r.size, 1)))
    if xs_all:
        xs = np.concatenate(xs_all).astype(np.float32)
        ys = np.concatenate(ys_all).astype(np.float32)
        cols = np.concatenate(cols_all)
        splat(img, xs, ys, cols * 0.6)
        add_glow(img, xs, ys, cols * 0.6, radius=8)
    # 漂流的心智：细长的光丝
    rng = np.random.default_rng(11)
    n = 26
    ph = rng.uniform(0, 1, n)
    for j in range(n):
        u = (ph[j] + t * 0.03) % 1
        a = rng.uniform(0, 6.28)
        x0, y0 = rng.uniform(0, W), rng.uniform(0, H)
        tt = np.linspace(0, 1, 60, dtype=np.float32)
        xs = (x0 + math.cos(a) * (u * 900 + tt * 120)) % W
        ys = (y0 + math.sin(a) * (u * 900 + tt * 120) + 30 * np.sin(tt * 6 + t)) % H
        col = np.array([0.5, 0.9, 1.0], np.float32) * (tt ** 2)[:, None] * 0.6 * math.sin(u * math.pi)
        splat(img, xs.astype(np.float32), ys.astype(np.float32), col)
        add_glow(img, xs[-1:], ys[-1:], np.array([[8, 14, 18]], np.float32) * math.sin(u * math.pi), radius=6)


def scene_merge(img, t, d):
    p = t / d
    k = smooth(p * 1.1)
    r = R["mr"] * (1 - k) ** 1.5
    th = R["mth"] + t * R["mspd"] * (0.3 + 3 * k) / (R["mr"] + 0.15)
    sc = 760
    xs = (W / 2 + r * np.cos(th) * sc).astype(np.float32)
    ys = (H / 2 + r * np.sin(th) * sc * 0.6).astype(np.float32)
    fade = 1 - smooth((p - 0.72) / 0.25)
    cols = R["mcol"] * (0.25 * fade)
    splat(img, xs, ys, cols)
    add_glow(img, xs, ys, cols * 0.8, radius=8)
    core = clamp01(k * 1.3) * fade
    dd = np.hypot(R["xx"] - W / 2, R["yy"] - H / 2)
    img += (np.exp(-dd / (6 + 22 * core)) * core * 1.2)[..., None] * np.array([0.9, 0.95, 1.0], np.float32)


def scene_dark(img, t, d):
    # 一个几乎看不见、缓慢呼吸的点：AC 在超空间中思考
    a = 0.06 + 0.04 * math.sin(t * 1.3)
    a *= 1 + 6 * smooth((t - (d - 3.0)) / 3.0) ** 3
    dd = np.hypot(R["xx"] - W / 2, R["yy"] - 360)
    img += (np.exp(-dd / 6) * a * 2)[..., None] * np.array([0.8, 0.9, 1.0], np.float32)


def scene_bang(img, t, d):
    xx, yy = R["xx"], R["yy"]
    # 闪光
    flash = math.exp(-t * 2.2) * 4.0
    dd = np.hypot(xx - W / 2, yy - H / 2)
    img += (np.exp(-dd / (60 + 900 * t)) * flash)[..., None] * np.array([1.0, 0.97, 0.9], np.float32)
    img += flash * 0.25
    # 膨胀的物质
    rad = 1250 * (1 - math.exp(-t * 0.42))
    dirs = R["bdir"]
    s = R["bspd"]
    wob = 0.08 * np.sin(R["bwob"][:, 0] + s * 12 + t * 0.3)
    rr = rad * s * (1 + wob)
    rot = t * 0.05
    x3 = dirs[:, 0] * math.cos(rot) - dirs[:, 2] * math.sin(rot)
    z3 = dirs[:, 0] * math.sin(rot) + dirs[:, 2] * math.cos(rot)
    persp = 1 / (1.6 - z3 * 0.5)
    xs = (W / 2 + x3 * rr * persp).astype(np.float32)
    ys = (H / 2 + dirs[:, 1] * rr * persp).astype(np.float32)
    heat = math.exp(-t * 0.6)
    cols = R["bcol"] * (1 - heat) + np.array([1, 1, 1], np.float32) * heat
    cols = cols * (0.35 + 0.65 * persp[:, None]) * 0.55
    splat(img, xs, ys, cols)
    add_glow(img, xs, ys, cols * 0.18, radius=14)
    # 新生恒星点亮
    born = smooth((t - 4) / 4)
    if born > 0:
        sel = slice(0, 2500)
        add_glow(img, xs[sel], ys[sel], R["bcol"][sel] * 20 * born, radius=4)
    # 新宇宙的温暖星云底色
    neb = np.exp(-dd / (300 + 500 * smooth(t / 6)))
    img += (neb * 0.25 * smooth(t / 3))[..., None] * np.array([0.35, 0.2, 0.45], np.float32)


def scene_credits(img, t, d):
    draw_stars(img, t + 40, gain=0.8, drift=3)


SCENE_FN = dict(title=scene_title, earth=scene_earth, warp=scene_warp, galaxy=scene_galaxy,
                cosmos=scene_cosmos, merge=scene_merge, dark=scene_dark, bang=scene_bang,
                credits=scene_credits)


# ----------------------------------------------------------------------------
# 文字层
# ----------------------------------------------------------------------------
def typed(item, t):
    cps = TYPE_CPS[item["k"]]
    n = int((t - item["t0"] - TYPE_DELAY[item["k"]]) * cps)
    return item["s"][:max(0, min(len(item["s"]), n))], n < len(item["s"])


def draw_text_layer(t):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(layer)
    any_text = False
    for it in TEXTS:
        if not (it["t0"] <= t <= it["t1"]):
            continue
        k = it["k"]
        a = env(t, it["t0"], it["t1"], 0.8, 0.8)
        if a <= 0:
            continue
        any_text = True
        A = int(255 * a)
        if k == "title":
            f = font(150)
            dr.text((W / 2, H / 2 - 40), it["s"], font=f, anchor="mm", fill=(235, 238, 255, A))
            # 字距感的细线
            wl = 380 * smooth((t - it["t0"]) / 2.5)
            dr.line([(W / 2 - wl, H / 2 + 70), (W / 2 + wl, H / 2 + 70)], fill=(160, 180, 255, A // 2), width=2)
        elif k == "subtitle":
            dr.text((W / 2, H / 2 + 120), it["s"], font=font(36), anchor="mm", fill=(170, 185, 230, A))
        elif k == "era":
            dr.line([(110, 108), (110, 190)], fill=(255, 190, 110, A), width=4)
            dr.text((136, 104), it["s"], font=font(46), fill=(240, 240, 250, A))
            dr.text((138, 166), it["sub"], font=font(24, 1), fill=(255, 190, 110, int(A * 0.85)))
        elif k == "narr":
            y = 852 + it["line"] * 64
            f = font(40)
            dr.text((W / 2 + 2, y + 2), it["s"], font=f, anchor="mm", fill=(0, 0, 0, int(A * 0.7)))
            dr.text((W / 2, y), it["s"], font=f, anchor="mm", fill=(228, 232, 245, A))
        elif k == "q":
            f = font(58)
            dr.text((W / 2 + 3, 842 + 3), it["s"], font=f, anchor="mm", fill=(0, 0, 0, int(A * 0.7)))
            dr.text((W / 2, 842), it["s"], font=f, anchor="mm", fill=(255, 255, 255, A))
        elif k in ("reply", "reply_c"):
            s, typing = typed(it, t)
            f = font(40, 1)
            y = 935 if k == "reply" else H / 2 + 230
            full_w = dr.textlength(it["s"], font=f)
            x0 = W / 2 - full_w / 2
            # 终端底框
            pad = 22
            dr.rectangle([x0 - pad, y - 34, x0 + full_w + pad + 24, y + 34], fill=(10, 14, 10, int(A * 0.55)),
                         outline=(255, 176, 60, int(A * 0.35)), width=1)
            dr.text((x0, y), s, font=f, anchor="lm", fill=(255, 186, 80, A))
            cur_on = typing or (int(t * 2.5) % 2 == 0)
            if cur_on:
                cx = x0 + dr.textlength(s, font=f) + 4
                dr.rectangle([cx, y - 20, cx + 18, y + 20], fill=(255, 186, 80, A))
        elif k == "center":
            dr.text((W / 2, H / 2 + 120), it["s"], font=font(44), anchor="mm", fill=(205, 212, 235, A))
        elif k == "big":
            s, typing = typed(it, t)
            f = font(120)
            full_w = dr.textlength(it["s"], font=f)
            x0 = W / 2 - full_w / 2
            dr.text((x0, H / 2 + 60), s, font=f, anchor="lm", fill=(255, 250, 235, 255))
            if typing or int(t * 2.5) % 2 == 0:
                cx = x0 + dr.textlength(s, font=f) + 8
                dr.rectangle([cx, H / 2 + 5, cx + 14, H / 2 + 115], fill=(255, 250, 235, 220))
        elif k == "center_low":
            f = font(56)
            dr.text((W / 2 + 3, H - 150 + 3), it["s"], font=f, anchor="mm", fill=(0, 0, 0, int(A * 0.6)))
            dr.text((W / 2, H - 150), it["s"], font=f, anchor="mm", fill=(255, 248, 235, A))
        elif k == "credit_title":
            dr.text((W / 2, 440), it["s"], font=font(96), anchor="mm", fill=(235, 238, 255, A))
        elif k == "credit_small":
            dr.text((W / 2, it["y"]), it["s"], font=font(34), anchor="mm", fill=(185, 195, 230, A))
        elif k == "credit_tiny":
            dr.text((W / 2, it["y"]), it["s"], font=font(24, 1), anchor="mm", fill=(130, 140, 175, A))
    return layer if any_text else None


# ----------------------------------------------------------------------------
# 帧合成
# ----------------------------------------------------------------------------
VIGNETTE = None


def render_frame(i):
    global VIGNETTE
    init_resources()
    if VIGNETTE is None:
        d = np.hypot((R["xx"] - W / 2) / (W / 2), (R["yy"] - H / 2) / (H / 2))
        VIGNETTE = (1 - 0.35 * d ** 2.2).clip(0, 1)[..., None].astype(np.float32)
    t = i / FPS
    img = np.zeros((H, W, 3), np.float32)
    for name, a, b in SCENES:
        if a <= t < b:
            fin = 0.4 if name == "bang" else 1.5
            fout = 0.05 if name == "dark" else 1.5
            e = env(t, a, b, fin, fout)
            if e > 0:
                SCENE_FN[name](img, t - a, b - a)
                img *= e
            break
    img *= VIGNETTE
    # 柔和色调映射
    img = 1 - np.exp(-img * 1.25)
    layer = draw_text_layer(t)
    if layer is not None:
        arr = np.asarray(layer, np.float32) / 255
        al = arr[..., 3:4]
        img = img * (1 - al) + arr[..., :3] * al
    # 胶片颗粒
    rng = np.random.default_rng(i)
    img += rng.normal(0, 0.008, (H // 2, W // 2, 1)).repeat(2, 0).repeat(2, 1).astype(np.float32)
    return (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8).tobytes()


# ----------------------------------------------------------------------------
# 声音：程序化合成配乐
# ----------------------------------------------------------------------------
def note(n):  # MIDI -> Hz
    return 440 * 2 ** ((n - 69) / 12)


CHORDS = {  # 每个场景的和弦（MIDI）
    "title": [38, 45, 50, 57, 62],
    "earth": [41, 48, 53, 57, 64],
    "warp": [36, 43, 50, 55, 62],
    "galaxy": [40, 47, 52, 55, 59, 66],
    "cosmos": [33, 40, 45, 48, 55],
    "merge": [31, 38, 43, 50],
    "dark": [26, 33],
    "bang": [38, 45, 50, 54, 57, 62, 66, 69],
    "credits": [38, 45, 50, 54, 57, 64],
}


def synth_audio(path):
    n = int(DURATION * SR)
    t = np.arange(n) / SR
    L = np.zeros(n)
    Rr = np.zeros(n)
    rng = np.random.default_rng(42)

    def senv(a, b, fin, fout):
        x = np.clip((t - a) / fin, 0, 1) * np.clip((b - t) / fout, 0, 1)
        return x * x * (3 - 2 * x)

    # 和声垫底
    for name, a, b in SCENES:
        e = senv(a - 1.5, b + 1.5, 3.0, 3.0)
        if name == "bang":
            e = senv(a, b + 1.5, 0.05, 3.0)
        if name == "dark":
            e = senv(a - 1.5, b, 3.0, 0.4)
        m = (e > 0)
        tt = t[m]
        vol = {"dark": 0.5, "bang": 1.1, "credits": 0.9}.get(name, 0.8)
        for j, mn in enumerate(CHORDS[name]):
            f = note(mn)
            lfo = 0.55 + 0.45 * np.sin(2 * np.pi * (0.05 + 0.02 * j) * tt + j)
            amp = vol * 0.11 / (1 + j * 0.35) * lfo
            for det, side in ((-0.18, 0), (0.18, 1)):
                ph = rng.uniform(0, 6.28)
                wv = np.sin(2 * np.pi * (f + det) * tt + ph) + 0.18 * np.sin(4 * np.pi * (f + det) * tt + ph)
                (L if side == 0 else Rr)[m] += wv * amp * e[m]
    # 跃迁的呼啸（棕噪声）
    a, b = 29, 48
    m = (t > a - 1) & (t < b + 1)
    br = np.cumsum(rng.normal(0, 1, m.sum()))
    br -= np.convolve(br, np.ones(2000) / 2000, mode="same")
    br /= np.abs(br).max() + 1e-9
    sp = np.interp(t[m] - a, [0, 4, 10, 14, 19], [0.2, 1, 1, 0.3, 0.1])
    L[m] += br * 0.18 * sp
    Rr[m] += np.roll(br, 300) * 0.18 * sp
    # 打字音
    for it in TEXTS:
        if it["k"] not in TYPE_CPS:
            continue
        cps = TYPE_CPS[it["k"]]
        for c in range(len(it["s"])):
            ts = it["t0"] + TYPE_DELAY[it["k"]] + c / cps
            i0 = int(ts * SR)
            ln = int(0.05 * SR)
            if i0 + ln >= n:
                continue
            tt = np.arange(ln) / SR
            big = it["k"] == "big"
            freq = 520 if big else 1250 + 120 * (c % 3)
            blip = np.sin(2 * np.pi * freq * tt) * np.exp(-tt * (40 if big else 90))
            click = rng.normal(0, 1, ln) * np.exp(-tt * 400) * 0.3
            g = 0.16 if big else 0.07
            L[i0:i0 + ln] += (blip + click) * g
            Rr[i0:i0 + ln] += (blip + click) * g
    # Multivac 运算的嘀嗒声
    for k in range(60):
        ts = 21.6 - 3 + k * 0.05
        i0 = int(ts * SR)
        ln = int(0.03 * SR)
        tt = np.arange(ln) / SR
        f = rng.choice([880, 990, 1320, 1760])
        s = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 120) * 0.03
        L[i0:i0 + ln] += s
        Rr[i0:i0 + ln] += s
    # 大爆炸
    tb = 119.0
    m = t >= tb
    tt = t[m] - tb
    boom = np.sin(2 * np.pi * (28 + 50 * np.exp(-tt * 3)) * tt) * np.exp(-tt * 0.7)
    noise = rng.normal(0, 1, m.sum())
    noise = np.convolve(noise, np.ones(30) / 30, mode="same") * np.exp(-tt * 1.2)
    L[m] += boom * 0.9 + noise * 0.9
    Rr[m] += boom * 0.9 + np.roll(noise, 500) * 0.9
    # 黑暗中的上升音（大爆炸前）
    m = (t > 113) & (t < tb)
    tt = t[m] - 113
    rise = np.sin(2 * np.pi * (60 * 2 ** (tt / 3)) * tt) * (tt / 6) ** 3 * 0.15
    L[m] += rise
    Rr[m] += rise
    # 简易混响
    for dly, g in ((0.031, 0.35), (0.047, 0.3), (0.071, 0.25), (0.113, 0.2), (0.167, 0.15)):
        k = int(dly * SR)
        L[k:] += Rr[:-k] * g * 0.6
        Rr[k:] += L[:-k] * g * 0.6
    # 首尾淡入淡出 + 归一化
    fade = np.clip(t / 1.5, 0, 1) * np.clip((DURATION - t) / 2.5, 0, 1)
    st = np.stack([L, Rr], 1) * fade[:, None]
    st = np.tanh(st / (np.abs(st).max() + 1e-9) * 1.6) * 0.85
    pcm = (st * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


# ----------------------------------------------------------------------------
def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "the-last-question.mp4")
    args = sys.argv[1:]
    preview = None
    if "--preview" in args:
        k = args.index("--preview")
        preview = [float(x) for x in args[k + 1].split(",")]
        del args[k:k + 2]
    if args:
        out = args[0]

    if preview:  # 输出若干静帧用于检查
        for s in preview:
            init_resources()
            frame = render_frame(int(s * FPS))
            Image.frombytes("RGB", (W, H), frame).save(os.path.join(os.path.dirname(out), f"preview_{s:06.1f}.png"))
            print("preview", s)
        return

    wav = out + ".wav"
    print("合成音频…")
    synth_audio(wav)
    total = int(DURATION * FPS)
    print(f"渲染 {total} 帧…")
    ff = subprocess.Popen([
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-i", wav,
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out,
    ], stdin=subprocess.PIPE)
    with Pool(os.cpu_count()) as pool:
        for i, fr in enumerate(pool.imap(render_frame, range(total), chunksize=4)):
            ff.stdin.write(fr)
            if i % (FPS * 5) == 0:
                print(f"  {i / FPS:6.1f}s / {DURATION}s", flush=True)
    ff.stdin.close()
    ff.wait()
    os.remove(wav)
    print("完成：", out)


if __name__ == "__main__":
    main()
