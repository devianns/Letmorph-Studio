import type { ImageMotionPreset, MotionItem, MotionItemUpdate } from '../../domain/motionItem'

export const motionOptions: { id: ImageMotionPreset; name: string; description: string }[] = [
  { id: 'sway', name: '살랑살랑', description: '천천히 좌우로 흔들려요' },
  { id: 'bounce', name: '통통', description: '위아래로 튀어요' },
  { id: 'nod', name: '끄덕끄덕', description: '부드럽게 기울여요' },
  { id: 'float', name: '둥실둥실', description: '천천히 떠다녀요' },
  { id: 'swing', name: '흔들흔들', description: '회전하며 흔들려요' },
  { id: 'pulse', name: '두근두근', description: '크기가 커졌다 작아져요' },
  { id: 'wobble', name: '빙글빙글', description: '빠르게 여러 방향으로 움직여요' },
  { id: 'breathe', name: '숨쉬기', description: '천천히 부풀었다 돌아와요' },
  { id: 'shake', name: '파르르', description: '작고 빠르게 떨려요' },
]

interface PropertiesPanelProps {
  item?: MotionItem
  tool: 'select' | 'pen'
  onCheckpoint(): void
  onUpdate(changes: MotionItemUpdate): void
  onCommit(changes: MotionItemUpdate): void
  onSelectTool(tool: 'select' | 'pen'): void
  onDisableBoundaryEdit(): void
}

export function PropertiesPanel({ item, tool, onCheckpoint, onUpdate, onCommit, onSelectTool, onDisableBoundaryEdit }: PropertiesPanelProps) {
  return <aside className="right-panel"><div className="right-heading"><span className="eyebrow">아이템 속성</span><h2>{item?.name ?? '아이템을 선택하세요'}</h2></div>
    {item ? <div className="item-properties">
      <label className="property-name">이름<input value={item.name} onFocus={onCheckpoint} onChange={event => onUpdate({ name: event.target.value })} /></label>
      {item.kind === 'empty' && <p className="selection-hint">아직 그려진 영역이 없는 빈 아이템입니다. 펜으로 영역을 닫으면 이 아이템에 저장됩니다.</p>}
      <div className="section-label motion-label">움직임</div><div className="motion-options" role="radiogroup" aria-label="움직임 선택">{motionOptions.map(option => <button key={option.id} className={`motion-option ${item.preset === option.id ? 'selected' : ''}`} role="radio" aria-checked={item.preset === option.id} onClick={() => onCommit({ preset: option.id })}><span className={`motion-symbol ${option.id}`}>{option.id === 'sway' ? '↝' : option.id === 'bounce' ? '↟' : '↶'}</span><span><strong>{option.name}</strong><small>{option.description}</small></span></button>)}</div>
      <label className="range-control"><span>움직임 크기 <b>{item.amount}%</b></span><input type="range" min="0" max="100" value={item.amount} onPointerDown={onCheckpoint} onFocus={onCheckpoint} onChange={event => onUpdate({ amount: Number(event.target.value) })} /></label>
      <label className="range-control"><span>아이템 크기 <input className="size-value" aria-label="아이템 크기 배율" type="number" min="0.1" max="5" step="0.01" value={(item.sizeMultiplier ?? 1).toFixed(2)} onFocus={onCheckpoint} onChange={event => { const sizeMultiplier = Number(event.target.value); if (Number.isFinite(sizeMultiplier)) onUpdate({ sizeMultiplier: Math.max(0.1, Math.min(5, sizeMultiplier)) }) }} /><b>×</b></span><input aria-label="선택 아이템 크기" type="range" min="0.1" max="5" step="0.01" value={item.sizeMultiplier ?? 1} onPointerDown={onCheckpoint} onFocus={onCheckpoint} onChange={event => onUpdate({ sizeMultiplier: Number(event.target.value) })} /></label>
      <label className="range-control"><span>가로 위치 <b>{item.positionX ?? 0}%</b></span><input type="range" min="-300" max="300" value={item.positionX ?? 0} onPointerDown={onCheckpoint} onFocus={onCheckpoint} onChange={event => onUpdate({ positionX: Number(event.target.value) })} /></label>
      <label className="range-control"><span>세로 위치 <b>{item.positionY ?? 0}%</b></span><input type="range" min="-300" max="300" value={item.positionY ?? 0} onPointerDown={onCheckpoint} onFocus={onCheckpoint} onChange={event => onUpdate({ positionY: Number(event.target.value) })} /></label>
      <label className="range-control"><span>움직임 속도 <b>{item.speed.toFixed(1)}배</b></span><input type="range" min="0.5" max="1.8" step="0.1" value={item.speed} onPointerDown={onCheckpoint} onFocus={onCheckpoint} onChange={event => onUpdate({ speed: Number(event.target.value) })} /></label>
      <div className="section-label tuning-heading">세부 조절 <small>프리셋 움직임의 축별 크기</small></div>
      {([
        ['horizontal', '좌우 이동', '좌우 움직임'], ['vertical', '위아래 이동', '위아래 움직임'], ['rotation', '회전', '기울어지는 크기'], ['scale', '크기 변화', '커지고 작아지는 정도'],
      ] as const).map(([key, label, help]) => <label className="range-control tuning-control" key={key} title={help}><span>{label} <b>{item[key] ?? 100}%</b></span><input type="range" min="-100" max="100" value={item[key] ?? 100} onPointerDown={onCheckpoint} onFocus={onCheckpoint} onChange={event => onUpdate({ [key]: Number(event.target.value) })} /></label>)}
      <div className="section-label tuning-heading">고급 모핑 <small>영역 안의 위치별 변형</small></div>
      <label className="trail-toggle"><input type="checkbox" checked={Boolean(item.morphMode)} onChange={event => onCommit(event.target.checked ? { morphMode: 'wave', morphAmount: item.morphAmount ?? 40, morphAngle: item.morphAngle ?? 0, morphFrequency: item.morphFrequency ?? 2, morphWidthBias: item.morphWidthBias ?? 0 } : { morphMode: undefined })} /><span>공간 모핑 사용</span></label>
      {item.morphMode && <>
        <label className="range-control"><span>모핑 방식</span><select className="morph-select" value={item.morphMode} onChange={event => onCommit({ morphMode: event.target.value as NonNullable<MotionItem['morphMode']> })}><option value="wave">물결</option><option value="bend">굽힘</option><option value="ripple">방사형 파동</option><option value="flutter">가장자리 펄럭임</option><option value="pinch">중심 수축·팽창</option></select></label>
        {([['morphAmount', '변형 강도', 0, 100, 1, '%'], ['morphAngle', '변형 방향', 0, 360, 1, '°'], ['morphFrequency', '공간 빈도', 1, 8, 1, ''], ['morphWidthBias', '좌우 강도 편차', -100, 100, 1, '%']] as const).map(([key, label, min, max, step, unit]) => <label className="range-control tuning-control" key={key}><span>{label} <b>{item[key] ?? (key === 'morphAmount' ? 40 : key === 'morphFrequency' ? 2 : 0)}{unit}</b></span><input type="range" min={min} max={max} step={step} value={item[key] ?? (key === 'morphAmount' ? 40 : key === 'morphFrequency' ? 2 : 0)} onPointerDown={onCheckpoint} onFocus={onCheckpoint} onChange={event => onUpdate({ [key]: Number(event.target.value) })} /></label>)}
        <p className="selection-hint">방향과 빈도로 변형의 진행 방향과 반복 수를 정합니다. 좌우 편차는 선택 영역의 좌우에 서로 다른 힘을 줍니다.</p>
      </>}
      <div className="section-label tuning-heading">잔상 효과</div>
      <label className="trail-toggle"><input type="checkbox" checked={(item.trailCount ?? 0) > 0} onChange={event => onCommit({ trailCount: event.target.checked ? 3 : 0 })} /><span>이 아이템에 잔상 표시</span></label>
      {(item.trailCount ?? 0) > 0 && <>
        <label className="range-control tuning-control"><span>잔상 개수 <b>{item.trailCount}</b></span><input type="range" min="1" max="32" step="1" value={item.trailCount} onPointerDown={onCheckpoint} onFocus={onCheckpoint} onChange={event => onUpdate({ trailCount: Number(event.target.value) })} /></label>
        <label className="range-control tuning-control"><span>시간 간격 <b>{item.trailIntervalMs ?? 40}ms</b></span><input type="range" min="10" max="200" step="10" value={item.trailIntervalMs ?? 40} onPointerDown={onCheckpoint} onFocus={onCheckpoint} onChange={event => onUpdate({ trailIntervalMs: Number(event.target.value) })} /></label>
        <label className="range-control tuning-control"><span>잔상 불투명도 <b>{item.trailOpacity ?? 35}%</b></span><input type="range" min="5" max="80" value={item.trailOpacity ?? 35} onPointerDown={onCheckpoint} onFocus={onCheckpoint} onChange={event => onUpdate({ trailOpacity: Number(event.target.value) })} /></label>
        <label className="range-control tuning-control"><span>뒤로 갈수록 흐리게 <b>{item.trailFade ?? 75}%</b></span><input type="range" min="0" max="100" value={item.trailFade ?? 75} onPointerDown={onCheckpoint} onFocus={onCheckpoint} onChange={event => onUpdate({ trailFade: Number(event.target.value) })} /></label>
      </>}
      {item.points && <>
        <div className="section-label tuning-heading">선택 영역 다듬기</div>
        <label className="range-control tuning-control"><span>모서리 둥글게 <b>{item.edgeSmoothing ?? 0}%</b></span><input type="range" min="0" max="100" value={item.edgeSmoothing ?? 0} onPointerDown={onCheckpoint} onFocus={onCheckpoint} onChange={event => onUpdate({ edgeSmoothing: Number(event.target.value) })} /></label>
        <p className="selection-hint">그린 다각형의 꼭짓점을 둥글게 깎습니다. 0%면 그린 경계를 그대로 사용합니다.</p>
        <label className="range-control tuning-control"><span>안쪽 경계 흐림 <b>{(item.edgeFeather ?? 0).toFixed(1)}%</b></span><input type="range" min="0" max="3" step="0.1" value={item.edgeFeather ?? 0} onPointerDown={onCheckpoint} onFocus={onCheckpoint} onChange={event => onUpdate({ edgeFeather: Number(event.target.value) })} /></label>
        <p className="selection-hint">선 안쪽 픽셀만 투명하게 섞어 경계를 흐립니다. 선택한 영역 바깥으로 번지지 않습니다. 0%면 흐림이 없습니다.</p>
        <button className="selection-button edit-region" aria-pressed={tool === 'pen'} onClick={() => { onDisableBoundaryEdit(); onSelectTool('pen') }}>{tool === 'pen' ? '그리기 모드 켜짐' : '펜으로 영역 다시 그리기'}</button>
      </>}
    </div> : <div className="inspector-empty"><div className="layers-icon">▤</div><strong>목록에서 아이템을 고르거나 새로 만드세요</strong><p>선택한 아이템마다 이름과 움직임을 따로 관리할 수 있어요.</p></div>}
    <div className="format-note"><span>ⓘ</span><p>각 레이어를 선택해 영역 그리기, 위치·크기 조절, 움직임 설정을 독립적으로 할 수 있습니다. 영역을 다시 그려도 입력 이미지는 보존됩니다.</p></div>
  </aside>
}


