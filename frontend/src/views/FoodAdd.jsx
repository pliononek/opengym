import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFood } from '../store/useFood.js'
import { useUI } from '../store/useUI.js'
import { todayISO, fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { addEntry, favoritesOf, addFavorite, removeFavorite, updateFavorite, touchFavorite } from '../lib/nutrition.js'
import { hasKey, estimateFromText, estimateFromPhoto, imageToBase64 } from '../lib/nutrition-ai.js'
import { searchFood, lookupBarcode, extractCodeFromQr, scalePer100 } from '../lib/nutrition-off.js'
import Icon from '../components/Icon.jsx'
import { Button, NumberField, TextField } from '../components/ui.jsx'

// ───────────────────────── sheet helpers (modal, promise-based) ─────────────

// Labelled number field for food forms — shows what each box is for.
function Fld({ label, ...rest }) {
  return <div>
    <span className="f-lbl">{label}</span>
    <NumberField {...rest} />
  </div>
}


function GramsPicker({ name, per100, defaultG = 100, resolve, close }) {
  const [g, setG] = useState(defaultG || 100)
  const s = scalePer100(per100, g > 0 ? g : 0)
  return <div style={{ textAlign: 'center' }}>
    <h3>{name}</h3>
    <p className="muted small" style={{ textAlign: 'center', marginBottom: 14 }}>
      {t('Per 100 g:')} {fmtNum(per100.kcal)} {t('kcal')} · {t('P')} {fmtNum(per100.p)} · {t('C')} {fmtNum(per100.c)} · {t('F')} {fmtNum(per100.f)}
    </p>
    <div className="row" style={{ gap: 8 }}>
      <span className="stp-l" style={{ flex: 'none' }}>g</span>
      <NumberField value={g} onChange={setG} style={{ flex: 1 }} />
    </div>
    <div className="row between" style={{ margin: '10px 0 14px' }}>
      <span className="muted small">{name}</span>
      <b className="accent" style={{ fontSize: 18 }}>{fmtNum(s.kcal)} {t('kcal')}</b>
    </div>
    <Button variant="primary" onClick={() => { close(); resolve(g > 0 ? g : null) }}>{t('Add')}</Button>
    <div style={{ height: 8 }} /><Button variant="ghost" className="dim" onClick={() => { close(); resolve(null) }}>{t('Cancel')}</Button>
  </div>
}

const gramsSheet = async ({ name, per100, defaultG = 100, code, source = 'off' }) => {
  const ui = useUI.getState()
  const g = await new Promise(resolve => {
    ui.openSheet(close => <GramsPicker name={name} per100={per100} defaultG={defaultG} resolve={resolve} close={close} />)
  })
  if (!g) return null
  const scaled = scalePer100(per100, g)
  return { name, g, ...scaled, per100, code, source }
}

function EstimateConfirm({ draft, model, resolve, close }) {
  const [e, setE] = useState(draft)

  const [per100, setPer100] = useState(() => {
    if (draft.per100 && (draft.per100.kcal > 0 || draft.per100.p > 0 || draft.per100.c > 0 || draft.per100.f > 0)) {
      return {
        kcal: Number(draft.per100.kcal) || 0,
        p: Number(draft.per100.p) || 0,
        c: Number(draft.per100.c) || 0,
        f: Number(draft.per100.f) || 0,
      }
    }
    const g = Number(draft.g) || 0
    if (g > 0) {
      const factor = 100 / g
      return {
        kcal: Math.round((Number(draft.kcal) || 0) * factor),
        p: Math.round((Number(draft.p) || 0) * factor * 10) / 10,
        c: Math.round((Number(draft.c) || 0) * factor * 10) / 10,
        f: Math.round((Number(draft.f) || 0) * factor * 10) / 10,
      }
    }
    return null
  })

  const onGramsChange = newG => {
    const gVal = typeof newG === 'number' ? newG : parseFloat(newG) || 0
    if (gVal > 0 && per100) {
      const r = gVal / 100
      const nextKcal = Math.round(per100.kcal * r)
      const nextP = Math.round(per100.p * r * 10) / 10
      const nextC = Math.round(per100.c * r * 10) / 10
      const nextF = Math.round(per100.f * r * 10) / 10
      setE(prev => ({
        ...prev,
        g: gVal,
        kcal: nextKcal,
        p: nextP,
        c: nextC,
        f: nextF,
        per100,
      }))
    } else if (gVal > 0 && !per100 && (e.kcal > 0 || e.p > 0 || e.c > 0 || e.f > 0)) {
      const factor = 100 / gVal
      const derived = {
        kcal: Math.round((Number(e.kcal) || 0) * factor),
        p: Math.round((Number(e.p) || 0) * factor * 10) / 10,
        c: Math.round((Number(e.c) || 0) * factor * 10) / 10,
        f: Math.round((Number(e.f) || 0) * factor * 10) / 10,
      }
      setPer100(derived)
      setE(prev => ({ ...prev, g: gVal, per100: derived }))
    } else {
      setE(prev => ({ ...prev, g: gVal }))
    }
  }

  const onMacroChange = (key, val) => {
    const numVal = Math.max(0, Number(val) || 0)
    setE(prev => {
      const next = { ...prev, [key]: numVal }
      const g = Number(next.g) || 0
      if (g > 0) {
        const factor = 100 / g
        setPer100(prevP100 => ({
          ...(prevP100 || { kcal: 0, p: 0, c: 0, f: 0 }),
          [key]: key === 'kcal' ? Math.round(numVal * factor) : Math.round(numVal * factor * 10) / 10,
        }))
      }
      return next
    })
  }

  return <>
    <h3>{t('Estimated')}{model ? <span className="dim" style={{ fontSize: 12, marginLeft: 8 }}>{model}</span> : null}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{t('Check the numbers — you can correct anything before saving.')}</div>
    <TextField placeholder={t('Name')} value={e.name || ''} onChange={ev => setE(prev => ({ ...prev, name: ev.target.value }))} />
    <div className="f-editgrid" style={{ marginTop: 10 }}>
      <Fld label={t('Weight (g)')} value={e.g} onChange={onGramsChange} />
      <Fld label={t('Calories (kcal)')} value={e.kcal} onChange={v => onMacroChange('kcal', v)} />
      <Fld label={t('Protein (g)')} value={e.p} onChange={v => onMacroChange('p', v)} />
      <Fld label={t('Carbs (g)')} value={e.c} onChange={v => onMacroChange('c', v)} />
      <Fld label={t('Fat (g)')} value={e.f} onChange={v => onMacroChange('f', v)} />
    </div>
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={() => { close(); resolve({ ...e, per100: per100 || e.per100 }) }}>{t('Add')}</Button>
    <div style={{ height: 8 }} /><Button variant="ghost" className="dim" onClick={() => { close(); resolve(null) }}>{t('Cancel')}</Button>
  </>
}

const confirmEstimateSheet = async (draft, { model } = {}) => {
  const ui = useUI.getState()
  return await new Promise(resolve => {
    ui.openSheet(close => <EstimateConfirm draft={draft} model={model} resolve={resolve} close={close} />)
  })
}

// ───────────────────────────────── the page ─────────────────────────────────

const MODES = [
  { k: 'favorites', icon: 'star', title: () => t('Favorites'), sub: () => t('Your saved foods and meals') },
  { k: 'text', icon: 'pencil', title: () => t('Describe it'), sub: () => t('Type what you ate — AI estimates the macros') },
  { k: 'photo', icon: 'magnifier', title: () => t('Take a photo'), sub: () => t('Snap the plate — AI reads it and estimates a portion') },
  { k: 'barcode', icon: 'scale', title: () => t('Bar code / QR'), sub: () => t('Scan a product — exact data from Open Food Facts') },
  { k: 'manual', icon: 'plus', title: () => t('Enter by hand'), sub: () => t('No AI — type the numbers you know') }
]

const requireKey = toast => {
  toast(t('Add your Gemini key in Settings to use AI'))
  return false
}

export default function FoodAdd() {
  const nav = useNavigate()
  const toast = useUI(s => s.toast)
  const [mode, setMode] = useState(null)

  const saveEntry = (entry) => {
    useFood.getState().update(f => addEntry(f, todayISO(), entry))
    toast(t('Added'))
    nav('/food')
  }

  return <div className="narrow fadd">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/food')} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 10 }}><h1>{t('Add food')}</h1></div>
    </div>

    {mode === null ? <div className="add-modes">
      {MODES.map(m => (
        <button key={m.k} className="add-mode" onClick={() => setMode(m.k)}>
          <span className="am-ic"><Icon name={m.icon} /></span>
          <span className="am-t">{m.title()}</span>
          <span className="am-s">{m.sub()}</span>
        </button>
      ))}
    </div> : mode === 'favorites' ? <FavoritesMode toast={toast} onSave={saveEntry} onBack={() => setMode(null)} />
    : mode === 'text' ? <TextMode toast={toast} onSave={saveEntry} onBack={() => setMode(null)} />
    : mode === 'photo' ? <PhotoMode toast={toast} onSave={saveEntry} onBack={() => setMode(null)} />
    : mode === 'barcode' ? <BarcodeMode toast={toast} onSave={saveEntry} onBack={() => setMode(null)} />
    : <ManualMode toast={toast} onSave={saveEntry} onBack={() => setMode(null)} />}
  </div>
}

/* ──────────────────────────── favorites mode ──────────────────────────── */

function EditFavoriteSheet({ fav, close }) {
  const toast = useUI(s => s.toast)
  const [name, setName] = useState(fav.name)
  const [g, setG] = useState(fav.g || 100)
  const [kcal, setKcal] = useState(fav.kcal || 0)
  const [p, setP] = useState(fav.p || 0)
  const [c, setC] = useState(fav.c || 0)
  const [f, setF] = useState(fav.f || 0)

  const [per100, setPer100] = useState(() => {
    if (fav.per100 && (fav.per100.kcal > 0 || fav.per100.p > 0 || fav.per100.c > 0 || fav.per100.f > 0)) {
      return {
        kcal: Number(fav.per100.kcal) || 0,
        p: Number(fav.per100.p) || 0,
        c: Number(fav.per100.c) || 0,
        f: Number(fav.per100.f) || 0,
      }
    }
    const favG = Number(fav.g) || 0
    if (favG > 0) {
      const factor = 100 / favG
      return {
        kcal: Math.round((Number(fav.kcal) || 0) * factor),
        p: Math.round((Number(fav.p) || 0) * factor * 10) / 10,
        c: Math.round((Number(fav.c) || 0) * factor * 10) / 10,
        f: Math.round((Number(fav.f) || 0) * factor * 10) / 10,
      }
    }
    return null
  })

  const onGramsChange = newG => {
    const gVal = typeof newG === 'number' ? newG : parseFloat(newG) || 0
    setG(gVal)
    if (gVal > 0 && per100) {
      const r = gVal / 100
      setKcal(Math.round(per100.kcal * r))
      setP(Math.round(per100.p * r * 10) / 10)
      setC(Math.round(per100.c * r * 10) / 10)
      setF(Math.round(per100.f * r * 10) / 10)
    } else if (gVal > 0 && !per100 && (kcal > 0 || p > 0 || c > 0 || f > 0)) {
      const factor = 100 / gVal
      const derived = {
        kcal: Math.round((Number(kcal) || 0) * factor),
        p: Math.round((Number(p) || 0) * factor * 10) / 10,
        c: Math.round((Number(c) || 0) * factor * 10) / 10,
        f: Math.round((Number(f) || 0) * factor * 10) / 10,
      }
      setPer100(derived)
    }
  }

  const onMacroChange = (setter, key, val) => {
    const numVal = Math.max(0, Number(val) || 0)
    setter(numVal)
    const currentG = Number(g) || 0
    if (currentG > 0) {
      const factor = 100 / currentG
      setPer100(prev => ({
        ...(prev || { kcal: 0, p: 0, c: 0, f: 0 }),
        [key]: key === 'kcal' ? Math.round(numVal * factor) : Math.round(numVal * factor * 10) / 10,
      }))
    }
  }

  const save = () => {
    if (!name.trim()) { toast(t('Give it a name')); return }
    useFood.getState().update(food => updateFavorite(food, fav.id, {
      name: name.trim(),
      g: Math.round(g),
      kcal: Math.round(kcal),
      p: Math.round(p * 10) / 10,
      c: Math.round(c * 10) / 10,
      f: Math.round(f * 10) / 10,
      per100: per100 || fav.per100,
    }))
    close()
    toast(t('Saved'))
  }

  return <>
    <h3>{t('Edit favorite')}</h3>
    <TextField placeholder={t('Name')} value={name} onChange={e => setName(e.target.value)} />
    <div className="f-editgrid" style={{ marginTop: 12 }}>
      <Fld label={t('Weight (g)')} value={g} onChange={onGramsChange} />
      <Fld label={t('Calories (kcal)')} value={kcal} onChange={v => onMacroChange(setKcal, 'kcal', v)} />
      <Fld label={t('Protein (g)')} value={p} onChange={v => onMacroChange(setP, 'p', v)} />
      <Fld label={t('Carbs (g)')} value={c} onChange={v => onMacroChange(setC, 'c', v)} />
      <Fld label={t('Fat (g)')} value={f} onChange={v => onMacroChange(setF, 'f', v)} />
    </div>
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={save}>{t('Save')}</Button>
    <div style={{ height: 8 }} /><Button variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </>
}

function NewFavoriteSheet({ close }) {
  const toast = useUI(s => s.toast)
  const [name, setName] = useState('')
  const [g, setG] = useState(100)
  const [kcal, setKcal] = useState(0)
  const [p, setP] = useState(0)
  const [c, setC] = useState(0)
  const [f, setF] = useState(0)
  const [per100, setPer100] = useState(null)

  const onGramsChange = newG => {
    const gVal = typeof newG === 'number' ? newG : parseFloat(newG) || 0
    setG(gVal)
    if (gVal > 0 && per100) {
      const r = gVal / 100
      setKcal(Math.round(per100.kcal * r))
      setP(Math.round(per100.p * r * 10) / 10)
      setC(Math.round(per100.c * r * 10) / 10)
      setF(Math.round(per100.f * r * 10) / 10)
    } else if (gVal > 0 && !per100 && (kcal > 0 || p > 0 || c > 0 || f > 0)) {
      const factor = 100 / gVal
      setPer100({
        kcal: Math.round((Number(kcal) || 0) * factor),
        p: Math.round((Number(p) || 0) * factor * 10) / 10,
        c: Math.round((Number(c) || 0) * factor * 10) / 10,
        f: Math.round((Number(f) || 0) * factor * 10) / 10,
      })
    }
  }

  const onMacroChange = (setter, key, val) => {
    const numVal = Math.max(0, Number(val) || 0)
    setter(numVal)
    const currentG = Number(g) || 0
    if (currentG > 0) {
      const factor = 100 / currentG
      setPer100(prev => ({
        ...(prev || { kcal: 0, p: 0, c: 0, f: 0 }),
        [key]: key === 'kcal' ? Math.round(numVal * factor) : Math.round(numVal * factor * 10) / 10,
      }))
    }
  }

  const save = () => {
    if (!name.trim()) { toast(t('Give it a name')); return }
    if (!kcal && !p && !c && !f) { toast(t('Fill in calories or at least one macro')); return }
    useFood.getState().update(food => addFavorite(food, {
      name: name.trim(),
      g: Math.round(g),
      kcal: Math.round(kcal),
      p: Math.round(p * 10) / 10,
      c: Math.round(c * 10) / 10,
      f: Math.round(f * 10) / 10,
      per100,
      source: 'manual',
    }))
    close()
    toast(t('Added to favorites'))
  }

  return <>
    <h3>{t('New favorite')}</h3>
    <TextField placeholder={t('Name — e.g. Chicken & rice bowl')} value={name} maxLength={120} onChange={e => setName(e.target.value)} />
    <div className="f-editgrid" style={{ marginTop: 12 }}>
      <Fld label={t('Weight (g)')} value={g} onChange={onGramsChange} />
      <Fld label={t('Calories (kcal)')} value={kcal} onChange={v => onMacroChange(setKcal, 'kcal', v)} />
      <Fld label={t('Protein (g)')} value={p} onChange={v => onMacroChange(setP, 'p', v)} />
      <Fld label={t('Carbs (g)')} value={c} onChange={v => onMacroChange(setC, 'c', v)} />
      <Fld label={t('Fat (g)')} value={f} onChange={v => onMacroChange(setF, 'f', v)} />
    </div>
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={save}>{t('Add to favorites')}</Button>
    <div style={{ height: 8 }} /><Button variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </>
}

function FavoritesMode({ toast, onSave, onBack }) {
  const ui = useUI()
  const food = useFood(s => s.food)
  const [query, setQuery] = useState('')
  const favorites = favoritesOf(food)

  const sorted = [...favorites].sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))
  const filtered = query.trim()
    ? sorted.filter(f => f.name.toLowerCase().includes(query.trim().toLowerCase()))
    : sorted

  const pickFavorite = async fav => {
    if (fav.g > 0) {
      let per100 = fav.per100
      if (!per100) {
        const factor = 100 / fav.g
        per100 = {
          kcal: Math.round(fav.kcal * factor),
          p: Math.round(fav.p * factor * 10) / 10,
          c: Math.round(fav.c * factor * 10) / 10,
          f: Math.round(fav.f * factor * 10) / 10
        }
      }
      const entry = await gramsSheet({
        name: fav.name,
        per100,
        defaultG: fav.g,
        code: fav.code,
        source: fav.source || 'manual'
      })
      if (entry) {
        useFood.getState().update(f => touchFavorite(f, fav.id))
        onSave(entry)
      }
    } else {
      useFood.getState().update(f => touchFavorite(f, fav.id))
      onSave({
        name: fav.name,
        g: 0,
        kcal: fav.kcal,
        p: fav.p,
        c: fav.c,
        f: fav.f,
        per100: fav.per100,
        code: fav.code,
        source: fav.source || 'manual'
      })
    }
  }

  const editFav = (e, fav) => {
    e.stopPropagation()
    ui.openSheet(close => <EditFavoriteSheet fav={fav} close={close} />)
  }

  const delFav = (e, fav) => {
    e.stopPropagation()
    useFood.getState().update(f => removeFavorite(f, fav.id))
    toast(t('Removed from favorites'))
  }

  const openNew = () => {
    ui.openSheet(close => <NewFavoriteSheet close={close} />)
  }

  return <>
    {favorites.length > 2 && (
      <div style={{ marginBottom: 12 }}>
        <TextField
          placeholder={t('Search favorites…')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>
    )}

    {filtered.length > 0 ? (
      <div className="food-list" style={{ marginBottom: 12 }}>
        {filtered.map(f => (
          <div
            key={f.id}
            className="food-item"
            style={{ cursor: 'pointer' }}
            onClick={() => pickFavorite(f)}
          >
            <span className="f-ic">
              <Icon name={f.code ? 'apple' : 'starFill'} style={{ color: 'var(--yellow)' }} />
            </span>
            <div className="f-main">
              <div className="f-name">{f.name}</div>
              <div className="f-meta">
                {f.g > 0 ? fmtNum(f.g) + ' g · ' : ''}
                {t('P')} {fmtNum(f.p)} · {t('C')} {fmtNum(f.c)} · {t('F')} {fmtNum(f.f)}
              </div>
            </div>
            <div className="f-cal">{fmtNum(f.kcal)}</div>
            <button
              className="iconbtn"
              style={{ width: 32, height: 30, borderRadius: 8, fontSize: 14 }}
              onClick={e => editFav(e, f)}
              aria-label={t('Edit')}
            >
              <Icon name="pencil" />
            </button>
            <button
              className="iconbtn"
              style={{ width: 32, height: 30, borderRadius: 8, fontSize: 14, color: 'var(--red)' }}
              onClick={e => delFav(e, f)}
              aria-label={t('Delete')}
            >
              <Icon name="trash" />
            </button>
          </div>
        ))}
      </div>
    ) : (
      <div className="empty" style={{ marginBottom: 14 }}>
        {query.trim()
          ? t('No matches found')
          : t('No favorite foods yet. Tap a star in your food diary or create one below.')}
      </div>
    )}

    <Button variant="primary" icon="plus" onClick={openNew}>
      {t('Add new favorite')}
    </Button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={onBack}>
      {t('Choose a different way')}
    </Button>
  </>
}

/* ─────────────────────────────── text mode ─────────────────────────────── */

function TextMode({ toast, onSave, onBack }) {
  const [desc, setDesc] = useState('')
  const [grams, setGrams] = useState(0)
  const [busy, setBusy] = useState(false)
  const [cands, setCands] = useState([])

  const ql = desc.trim()
  useEffect(() => {
    if (ql.length < 3) { setCands([]); return }
    const to = setTimeout(() => { searchFood(ql).then(setCands).catch(() => setCands([])) }, 500)
    return () => clearTimeout(to)
  }, [ql])

  const ai = async () => {
    if (!ql) { toast(t('Describe the food first')); return }
    if (!hasKey()) { requireKey(toast); return }
    setBusy(true)
    try {
      const draft = await estimateFromText(ql, { grams, cands })
      const entry = await confirmEstimateSheet(draft)
      if (entry) onSave(entry)
    } catch (e) {
      toast(e.message || t('AI estimate failed'))
    }
    setBusy(false)
  }

  const pick = async c => {
    const entry = await gramsSheet({ name: c.name, per100: c.per100, code: c.code })
    if (entry) onSave(entry)
  }

  return <>
    <div className="card">
      <div className="sect-t" style={{ padding: '0 2px 7px' }}>{t('Describe what you ate')}</div>
      <textarea className="field area" rows={3} placeholder={t('e.g. 2 eggs fried in butter + rye toast + coffee')} value={desc} maxLength={200}
        onChange={e => setDesc(e.target.value)} />
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <span className="stp-l" style={{ flex: 'none' }}>{t('grams (optional)')}</span>
        <NumberField value={grams} onChange={setGrams} style={{ flex: 1 }} />
      </div>
      <div className="row" style={{ gap: 6, marginTop: 10 }}>
        {!hasKey() && <span className="tag" style={{ opacity: 1 }}><Icon name="lock" style={{ fontSize: 12 }} />{t('AI needs a Gemini key — Settings')}</span>}
      </div>
      <div style={{ height: 10 }} />
      <Button variant="primary" icon="sparkles" disabled={busy} onClick={ai}>
        {busy ? t('Estimating…') : t('AI estimate')}
      </Button>
    </div>

    {cands.length > 0 && <div className="card">
      <div style={{ fontSize: 12, color: 'var(--label-3)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 600, marginBottom: 4 }}>
        {t('Open Food Facts matches')}
      </div>
      <div className="f-off">
        {cands.map(c => (
          <button key={c.code} className="item" style={{ textAlign: 'left', width: '100%' }} onClick={() => pick(c)}>
            <span className="lrow-i" style={{ background: 'var(--acc-soft)', color: 'var(--acc)' }}><Icon name="apple" /></span>
            <div className="grow"><div className="tt">{c.name}</div>
              <div className="ss">{fmtNum(c.per100.kcal)} kcal / 100 g · P {fmtNum(c.per100.p)} · C {fmtNum(c.per100.c)} · F {fmtNum(c.per100.f)}</div></div>
            <Icon name="plus" className="chev" />
          </button>
        ))}
      </div>
    </div>}

    <div style={{ height: 4 }} />
    <Button variant="ghost" className="dim" onClick={onBack}>{t('Choose a different way')}</Button>
  </>
}

/* ────────────────────────────── photo mode ────────────────────────────── */

function PhotoMode({ toast, onSave, onBack }) {
  const inputRef = useRef(null)
  const [dataUrl, setDataUrl] = useState(null)
  const [hint, setHint] = useState('')
  const [grams, setGrams] = useState(0)
  const [busy, setBusy] = useState(false)

  const onPick = ev => {
    const f = ev.target.files?.[0]
    if (!f) return
    imageToBase64(f).then(setDataUrl).catch(() => toast(t('Could not read that image')))
    ev.target.value = ''
  }

  const ai = async () => {
    if (!dataUrl) { toast(t('Take a photo first')); return }
    if (!hasKey()) { requireKey(toast); return }
    setBusy(true)
    try {
      const { draft, model } = await estimateFromPhoto(dataUrl, { grams, nameHint: hint })
      const entry = await confirmEstimateSheet(draft, { model })
      if (entry) onSave(entry)
    } catch (e) {
      toast(e.message || t('AI estimate failed'))
    }
    setBusy(false)
  }

  return <>
    <div className="card">
      <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onPick} />
      {dataUrl && <img className="fphoto-preview" src={dataUrl} alt="" />}
      <div className="row" style={{ gap: 8, marginBottom: 10 }}>
        <TextField placeholder={t('What is it? (optional hint)')} value={hint} onChange={e => setHint(e.target.value)} />
        <NumberField value={grams} onChange={setGrams} placeholder="g" />
      </div>
      <Button variant={dataUrl ? 'plain' : 'primary'} icon="magnifier" onClick={() => inputRef.current?.click()}>
        {dataUrl ? t('Pick a different photo') : t('Take a photo')}
      </Button>
      <div style={{ height: 8 }} />
      <Button variant="primary" icon="sparkles" disabled={!dataUrl || busy} onClick={ai}>
        {busy ? t('Looking at your plate…') : t('AI estimate')}
      </Button>
      {!hasKey() && <div className="small dim" style={{ marginTop: 8 }}>{t('AI needs a Gemini key set in Settings.')}</div>}
    </div>
    <Button variant="ghost" className="dim" onClick={onBack}>{t('Choose a different way')}</Button>
  </>
}

/* ───────────────────────────── barcode mode ───────────────────────────── */

function BarcodeMode({ toast, onSave, onBack }) {
  const videoRef = useRef(null)
  const [manual, setManual] = useState('')
  const [busy, setBusy] = useState(false)
  const readerRef = useRef(null)

  const run = async code => {
    setBusy(true)
    try {
      const p = await lookupBarcode(code)
      if (!p) { toast(t('No nutrition data for this product')); setBusy(false); return }
      const entry = await gramsSheet({ name: p.name, per100: p.per100, code: p.code })
      if (entry) onSave(entry); else setBusy(false)
    } catch (e) { toast(e.message || t('Could not reach Open Food Facts')); setBusy(false) }
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let active = true
    const load = async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        if (!active) return
        const reader = new BrowserMultiFormatReader()
        readerRef.current = reader
        let controls = null
        await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          video,
          (result) => {
            if (!result || !active) return
            const code = extractCodeFromQr(result.getText())
            if (!code) return
            active = false
            try { controls && controls.stop() } catch { /* already stopped */ }
            try { reader.reset() } catch { /* */ }
            run(code)
          }
        ).then(c => { controls = c })
      } catch (e) {
        if (active) toast(t('Camera unavailable — you can still type the code below.'))
      }
    }
    load()
    return () => {
      active = false
      if (readerRef.current) { try { readerRef.current.reset() } catch { /* */ } readerRef.current = null }
    }
  }, [])

  const submitManual = () => {
    const code = manual.replace(/\D/g, '').slice(0, 14)
    if (code.length < 8) { toast(t('Enter a barcode (8–14 digits)')); return }
    run(code)
  }

  return <>
    <div className="card">
      <div className="fscanner">
        <video ref={videoRef} playsInline style={{ width: '100%', height: '100%' }} />
        <div className="fscan-frame" />
        <div className="fscan-line" />
      </div>
      <div className="muted small" style={{ marginTop: 10 }}>{t('Point the camera at a barcode or QR.')}</div>
      <div style={{ height: 8 }} />
      <div className="sect-t" style={{ padding: '0 2px 7px' }}>{t('Or enter the code')}</div>
      <TextField placeholder={t('e.g. 5901234567890')} inputMode="numeric" value={manual} onChange={e => setManual(e.target.value)} />
      <div style={{ height: 10 }} />
      <Button variant="primary" disabled={busy} onClick={submitManual}>{t('Check code')}</Button>
      {busy && <div className="small dim" style={{ marginTop: 8 }}>{t('Looking it up…')}</div>}
    </div>
    <Button variant="ghost" className="dim" onClick={onBack}>{t('Choose a different way')}</Button>
  </>
}

/* ────────────────────────────── manual mode ────────────────────────────── */

function ManualMode({ toast, onSave, onBack }) {
  const [name, setName] = useState('')
  const [g, setG] = useState(100)
  const [kcal, setKcal] = useState(0)
  const [p, setP] = useState(0)
  const [c, setC] = useState(0)
  const [f, setF] = useState(0)
  const [per100, setPer100] = useState(null)

  const onGramsChange = newG => {
    const gVal = typeof newG === 'number' ? newG : parseFloat(newG) || 0
    setG(gVal)
    if (gVal > 0 && per100) {
      const r = gVal / 100
      setKcal(Math.round(per100.kcal * r))
      setP(Math.round(per100.p * r * 10) / 10)
      setC(Math.round(per100.c * r * 10) / 10)
      setF(Math.round(per100.f * r * 10) / 10)
    } else if (gVal > 0 && !per100 && (kcal > 0 || p > 0 || c > 0 || f > 0)) {
      const factor = 100 / gVal
      setPer100({
        kcal: Math.round((Number(kcal) || 0) * factor),
        p: Math.round((Number(p) || 0) * factor * 10) / 10,
        c: Math.round((Number(c) || 0) * factor * 10) / 10,
        f: Math.round((Number(f) || 0) * factor * 10) / 10,
      })
    }
  }

  const onMacroChange = (setter, key, val) => {
    const numVal = Math.max(0, Number(val) || 0)
    setter(numVal)
    const currentG = Number(g) || 0
    if (currentG > 0) {
      const factor = 100 / currentG
      setPer100(prev => ({
        ...(prev || { kcal: 0, p: 0, c: 0, f: 0 }),
        [key]: key === 'kcal' ? Math.round(numVal * factor) : Math.round(numVal * factor * 10) / 10,
      }))
    }
  }

  const save = () => {
    if (!name.trim()) { toast(t('Give it a name')); return }
    if (!kcal && !p && !c && !f) { toast(t('Fill in calories or at least one macro')); return }
    onSave({
      name: name.trim(),
      g: Math.round(g),
      kcal: Math.round(kcal),
      p: Math.round(p * 10) / 10,
      c: Math.round(c * 10) / 10,
      f: Math.round(f * 10) / 10,
      per100,
      source: 'manual',
    })
  }

  return <>
    <div className="card">
      <TextField placeholder={t('Name — e.g. Chicken & rice bowl')} value={name} maxLength={120} onChange={e => setName(e.target.value)} />
      <div className="f-editgrid" style={{ marginTop: 12 }}>
        <Fld label={t('Weight (g)')} value={g} onChange={onGramsChange} />
        <Fld label={t('Calories (kcal)')} value={kcal} onChange={v => onMacroChange(setKcal, 'kcal', v)} />
        <Fld label={t('Protein (g)')} value={p} onChange={v => onMacroChange(setP, 'p', v)} />
        <Fld label={t('Carbs (g)')} value={c} onChange={v => onMacroChange(setC, 'c', v)} />
        <Fld label={t('Fat (g)')} value={f} onChange={v => onMacroChange(setF, 'f', v)} />
      </div>
      <div style={{ height: 14 }} />
      <Button variant="primary" onClick={save}>{t('Add to diary')}</Button>
    </div>
    <Button variant="ghost" className="dim" onClick={onBack}>{t('Choose a different way')}</Button>
  </>
}
