/**
 * C002.7 identity debugger. State is (frame, params, followMotion). Every
 * rendered value is a pure function of that state; playback only advances the
 * integer frame number.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FILM, FILM_DURATION_IN_FRAMES} from '../config/film';
import {anchorStates} from '../identity/anchors';
import {validateSpec} from '../identity/invariants';
import {DEFAULT_MI_SPEC, graphSignature, identityFingerprint} from '../identity/miKernel';
import {generatePeriphery, peripheryNodePositionsAt} from '../geometry/neuralGraph';
import {distance} from '../geometry/vec3';
import {
	applyDeformation,
	DEFAULT_DEFORMATION_PARAMS,
	type DeformationParams,
	deformationFromParams,
	invertDeformation,
	motionParamsAt,
	validateDeformationParams,
} from '../motion/deformation';
import {pulseIntensities} from '../motion/pulse';
import {IdentityScene} from './IdentityScene';

const spec = DEFAULT_MI_SPEC;
const periphery = generatePeriphery(spec);

type UiState = {
	readonly frame: number;
	readonly followMotion: boolean;
	readonly params: DeformationParams;
};

export const DEFAULT_UI_STATE: UiState = Object.freeze({
	frame: 0,
	followMotion: false,
	params: DEFAULT_DEFORMATION_PARAMS,
});

type SliderDef = {key: keyof DeformationParams; label: string; min: number; max: number; step: number};

const SLIDERS: readonly SliderDef[] = [
	{key: 'yaw', label: '旋转 yaw (rad)', min: -Math.PI, max: Math.PI, step: 0.001},
	{key: 'pitch', label: '旋转 pitch (rad)', min: -Math.PI, max: Math.PI, step: 0.001},
	{key: 'roll', label: '旋转 roll (rad)', min: -Math.PI, max: Math.PI, step: 0.001},
	{key: 'scale', label: '缩放 scale', min: spec.deformation.scale.min, max: spec.deformation.scale.max, step: 0.001},
	{key: 'twist', label: '扭转 twist (rad/z)', min: -spec.deformation.twistRateMax, max: spec.deformation.twistRateMax, step: 0.001},
];

/** Fixed-point display that never shows "-0.000" for values that round to zero. */
const fmt = (n: number, d = 4) => (Math.abs(n) < 0.5 * 10 ** -d ? 0 : n).toFixed(d);

const row: React.CSSProperties = {display: 'grid', gridTemplateColumns: '150px 1fr 84px', gap: 8, alignItems: 'center', margin: '6px 0'};
const box: React.CSSProperties = {border: '1px solid #1d2747', borderRadius: 6, padding: '8px 10px', margin: '10px 0'};

export const DebuggerApp: React.FC = () => {
	const [ui, setUi] = useState<UiState>(DEFAULT_UI_STATE);
	const [playing, setPlaying] = useState(false);

	useEffect(() => {
		if (!playing) return;
		const id = setInterval(() => setUi((u) => ({...u, frame: (u.frame + 1) % FILM_DURATION_IN_FRAMES})), 1000 / FILM.fps);
		return () => clearInterval(id);
	}, [playing]);

	const time = ui.frame / FILM.fps;
	const params = ui.followMotion ? motionParamsAt(spec, time) : ui.params;
	const validation = validateDeformationParams(spec, params);
	const deformation = useMemo(
		() => (validation.ok ? deformationFromParams(spec, params) : deformationFromParams(spec, DEFAULT_DEFORMATION_PARAMS)),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[JSON.stringify(params), validation.ok],
	);
	const inverse = useMemo(() => invertDeformation(deformation), [deformation]);
	const anchors = useMemo(() => anchorStates(spec, deformation), [deformation]);
	const pulses = pulseIntensities(spec, time);
	const nodes = useMemo(() => peripheryNodePositionsAt(periphery, time), [time]);
	const specOk = validateSpec(spec).ok;

	const setParam = useCallback((key: keyof DeformationParams, value: number) => {
		if (!Number.isFinite(value)) return;
		setUi((u) => ({...u, params: {...u.params, [key]: value}}));
	}, []);

	const reset = useCallback(() => {
		setPlaying(false);
		setUi(DEFAULT_UI_STATE);
	}, []);

	const debugState = {
		version: spec.version,
		seed: spec.seed,
		fingerprint: identityFingerprint(spec),
		frame: ui.frame,
		time,
		followMotion: ui.followMotion,
		params,
		paramsValid: validation.ok,
		anchors: anchors.map((a) => ({
			id: a.id,
			s: a.s,
			world: a.world,
			inverseError: distance(applyDeformation(inverse, a.world), a.local),
			pulse: pulses[a.id],
		})),
	};

	return (
		<div style={{display: 'flex', height: '100%'}}>
			<aside style={{width: 430, padding: '12px 16px', overflowY: 'auto', fontSize: 13, borderRight: '1px solid #1d2747'}}>
				<h1 style={{fontSize: 17, margin: '4px 0 2px', color: '#e7eeff'}}>弥 · MI Identity Kernel Debugger</h1>
				<div style={box} data-testid="identity-info">
					<div>
						身份版本 version: <b data-testid="spec-version">{spec.version}</b>
					</div>
					<div>
						种子 seed: <b data-testid="spec-seed">0x{spec.seed.toString(16).toUpperCase()}</b> ({spec.seed})
					</div>
					<div>
						指纹 fingerprint: <b data-testid="spec-fingerprint">{identityFingerprint(spec)}</b>
					</div>
					<div>
						K: T({spec.knot.p},{spec.knot.q}) R={spec.knot.majorRadius} a={spec.knot.minorRadius}
					</div>
					<div style={{wordBreak: 'break-all'}}>G: {graphSignature(spec)}</div>
					<div>
						spec 校验: <b style={{color: specOk ? '#6bffb8' : '#ff6b6b'}}>{specOk ? 'VALID' : 'INVALID'}</b>
					</div>
				</div>

				<div style={box}>
					<div style={row}>
						<label htmlFor="frame">时间 frame</label>
						<input
							id="frame"
							type="range"
							min={0}
							max={FILM_DURATION_IN_FRAMES - 1}
							step={1}
							value={ui.frame}
							onChange={(e) => setUi((u) => ({...u, frame: Number(e.target.value)}))}
						/>
						<input
							data-testid="input-frame"
							type="number"
							min={0}
							max={FILM_DURATION_IN_FRAMES - 1}
							value={ui.frame}
							onChange={(e) => {
								const f = Math.round(Number(e.target.value));
								if (Number.isFinite(f)) setUi((u) => ({...u, frame: Math.min(FILM_DURATION_IN_FRAMES - 1, Math.max(0, f))}));
							}}
						/>
					</div>
					<div>
						t = {fmt(time, 3)} s / {FILM.durationInSeconds} s @ {FILM.fps} fps
					</div>
					<div style={{display: 'flex', gap: 8, marginTop: 6}}>
						<button type="button" data-testid="btn-play" onClick={() => setPlaying((p) => !p)}>
							{playing ? '暂停 Pause' : '播放 Play'}
						</button>
						<label>
							<input
								data-testid="toggle-motion"
								type="checkbox"
								checked={ui.followMotion}
								onChange={(e) => setUi((u) => ({...u, followMotion: e.target.checked}))}
							/>{' '}
							时间驱动形变 Φ(t)
						</label>
					</div>
				</div>

				<div style={box}>
					{SLIDERS.map((s) => (
						<div key={s.key} style={row}>
							<label htmlFor={`p-${s.key}`}>{s.label}</label>
							<input
								id={`p-${s.key}`}
								type="range"
								min={s.min}
								max={s.max}
								step={s.step}
								disabled={ui.followMotion}
								value={params[s.key]}
								onChange={(e) => setParam(s.key, Number(e.target.value))}
							/>
							<input
								data-testid={`input-${s.key}`}
								type="number"
								step={s.step}
								disabled={ui.followMotion}
								value={fmt(params[s.key], 3)}
								onChange={(e) => setParam(s.key, Number(e.target.value))}
							/>
						</div>
					))}
					<div>
						Φ 约束: <b style={{color: validation.ok ? '#6bffb8' : '#ff6b6b'}}>{validation.ok ? 'OK' : validation.errors.join('; ')}</b>
					</div>
					<button type="button" data-testid="btn-reset" onClick={reset} style={{marginTop: 8}}>
						恢复默认参数 Reset
					</button>
				</div>

				<div style={box}>
					<table style={{width: '100%', borderCollapse: 'collapse'}}>
						<thead>
							<tr style={{textAlign: 'left'}}>
								<th>锚点</th>
								<th>s</th>
								<th>Φ(K(s))</th>
								<th>脉冲</th>
								<th>|Φ⁻¹−K|</th>
							</tr>
						</thead>
						<tbody>
							{debugState.anchors.map((a, i) => (
								<tr key={a.id} data-testid={`anchor-${a.id}`}>
									<td>
										{a.id} {anchors[i].label}
									</td>
									<td>{fmt(a.s, 4)}</td>
									<td>{a.world.map((v) => fmt(v, 3)).join(', ')}</td>
									<td>{fmt(a.pulse, 2)}</td>
									<td>{a.inverseError.toExponential(1)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<output data-testid="debug-state" hidden>
					{JSON.stringify(debugState)}
				</output>
			</aside>
			<main style={{flex: 1, position: 'relative'}}>
				<IdentityScene
					spec={spec}
					deformation={deformation}
					anchors={anchors}
					pulses={pulses}
					peripheryNodes={nodes}
					peripheryEdges={periphery.edges}
					particles={periphery.particles}
				/>
			</main>
		</div>
	);
};
