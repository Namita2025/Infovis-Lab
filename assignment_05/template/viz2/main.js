import { state, onStateChange, setActiveYear, stopPlay, getThemeColor } from '../main.js';

const MEDAL_COLORS = { Gold:'--medal-gold', Silver:'--medal-silver', Bronze:'--medal-bronze' };
const token = name => getThemeColor(name);
const CONTINENT_COLORS = { Europe:'--continent-europe', Americas:'--continent-americas', Asia:'--continent-asia', Africa:'--continent-africa', Oceania:'--continent-oceania' };
const MODES = { efficiency:'Medal Efficiency', first:'First Achievement' };
const FLAG_ISO2 = { USA:'US',GBR:'GB',CHN:'CN',JPN:'JP',GER:'DE',FRA:'FR',ITA:'IT',ESP:'ES',RUS:'RU',AUS:'AU',CAN:'CA',BRA:'BR',IND:'IN',KOR:'KR',NED:'NL',SWE:'SE',NOR:'NO',SUI:'CH',NZL:'NZ',RSA:'ZA',MEX:'MX',ARG:'AR',KEN:'KE',ETH:'ET' };
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const flag = noc => FLAG_ISO2[noc] ? String.fromCodePoint(...[...FLAG_ISO2[noc]].map(c=>127397+c.charCodeAt())) : '';

function markup() {
  return `<div class="viz-action-toolbar"><button class="viz2-reset">Reset map</button></div><div class="viz2-shell">
    <section class="viz2-map-panel" aria-label="World medal efficiency map">
      <div class="viz2-map-head"><p>Summer Games · <span data-v2-host>2016 Rio de Janeiro</span></p><h3 data-v2-title>Medal efficiency</h3></div>
      <div class="viz2-map-wrap"><svg class="viz2-map" role="img" aria-label="World choropleth of Olympic medal performance"></svg></div>
      <div class="viz2-legend" aria-live="polite"></div>
      <div class="viz2-zoom-note">Scroll to zoom · drag to pan</div>
    </section>
    <aside class="viz2-side" aria-label="Games at a glance and selected-country details">
      <button class="viz2-collapse" aria-label="Collapse details" aria-expanded="true">?</button>
      <section class="viz2-kpi-panel" aria-live="polite" aria-label="Games at a glance">
        <h4>Games at a glance</h4>
        <div class="viz2-kpis">
          <article class="viz2-kpi-card"><strong data-v2-discipline-value>&mdash;</strong><span>Disciplines</span></article>
          <article class="viz2-kpi-card"><strong data-v2-medal-value>&mdash;</strong><span>Medals awarded</span></article>
        </div>
        <p class="viz2-kpi-status" data-v2-games-status hidden>Games not held</p>
      </section>
      <section class="viz2-detail" aria-live="polite"><p class="detail-empty">Select a country to pin its Olympic profile.</p></section>
    </aside>
    <section class="viz2-controls-dock" aria-label="Map filters">
      <div class="viz2-controls-block">
        <div class="viz2-controls-head"><h4>Shape the map</h4><div class="viz2-status"><i></i> Summer editions only</div></div>
        <div class="viz2-controls-grid">
          <div class="viz2-field"><label for="v2-sport">Sport</label><select id="v2-sport"></select></div>
          <div class="viz2-field"><label>Medals</label><div class="viz2-segments" data-v2-medal>${['All','Gold','Silver','Bronze'].map(x=>`<button data-value="${x}">${x==='All'?'':`<i class="medal-dot medal-${x.toLowerCase()}"></i>`}${x}</button>`).join('')}</div></div>
          <div class="viz2-field"><label for="v2-continent">Continent</label><select id="v2-continent"><option>All continents</option>${Object.entries(CONTINENT_COLORS).map(([x,c])=>`<option value="${x}">● ${x}</option>`).join('')}</select></div>
          <div class="viz2-field"><label>View</label><div class="viz2-segments" data-v2-mode>${Object.entries(MODES).map(([k,v])=>`<button data-value="${k}">${v}</button>`).join('')}</div></div>
          <div class="viz2-field" data-v2-first-control hidden><label>Achievement</label><div class="viz2-segments" data-v2-first><button data-value="medal">First medal</button><button data-value="gold">First gold</button></div></div>
        </div>
        <div class="viz2-actions"><label class="viz2-check"><input type="checkbox" data-v2-pies checked> Show medal pies</label></div>
      </div>
    </section>
    <div class="viz2-tooltip" hidden></div>
  </div>`;
}

export async function loadViz2() {
  const root = document.querySelector('#viz2-root');
  if (!root || root.dataset.loaded) return;
  root.dataset.loaded = 'true'; root.innerHTML = markup();
  const base = new URL('../public/data/', import.meta.url);
  const [payload, geo] = await Promise.all([
    fetch(new URL('viz2_efficiency_yearly.json', base)).then(r=>{if(!r.ok) throw Error('Viz 2 data unavailable');return r.json();}),
    fetch(new URL('countries.geo.json', base)).then(r=>r.json())
  ]).catch(error => { root.innerHTML = `<p class="viz2-error">${esc(error.message)}</p>`; return []; });
  if (!payload) return;
  const invalidFeatures = geo.features.filter(feature => d3.geoArea(feature) > 2 * Math.PI);
  if (invalidFeatures.length) {
    console.error(
      'Viz 2 skipped GeoJSON features with inverted or globe-spanning geometry:',
      invalidFeatures.map(feature => feature.properties?.name || feature.id)
    );
  }
  const mapGeo = {
    ...geo,
    features: geo.features.filter(feature => d3.geoArea(feature) <= 2 * Math.PI),
  };
  const records = payload.records || payload;
  const local = { sport:'All sports', medal:'All', continent:'All continents', mode:'efficiency', first:'medal', pies:true, selected:null, zoom:1 };
  const shell = root.querySelector('.viz2-shell'), svg = d3.select(root).select('.viz2-map'), tooltip = root.querySelector('.viz2-tooltip');
  const mapPanel = root.querySelector('.viz2-map-panel'), detail = root.querySelector('.viz2-detail');
  const yearStats = payload.year_stats || payload.yearStats || {};
  const disciplineValue = root.querySelector('[data-v2-discipline-value]');
  const medalValue = root.querySelector('[data-v2-medal-value]');
  const gamesStatus = root.querySelector('[data-v2-games-status]');
  let lastKpiYear = null;
  function renderGamesKpis() {
    if (lastKpiYear === state.activeYear) return;
    lastKpiYear = state.activeYear;
    const stats = yearStats[String(state.activeYear)] || yearStats[state.activeYear];
    const held = stats && stats.discipline_count > 0;
    const dash = String.fromCharCode(0x2014);
    disciplineValue.textContent = held ? stats.discipline_count : dash;
    medalValue.textContent = held ? stats.total_medals : dash;
    gamesStatus.hidden = held;
  }
  const sports = [...new Set(records.filter(d=>d.sport !== 'All sports').map(d=>d.sport))].sort();
  root.querySelector('#v2-sport').innerHTML = `<option>All sports</option>${sports.map(s=>`<option>${esc(s)}</option>`).join('')}`;
  const recordIndex = d3.group(records, d=>d.year, d=>d.sport, d=>d.geometry_name);
  const historyIndex = d3.group(records.filter(d=>d.sport==='All sports'), d=>d.noc);
  let projection, path, mapG, countryG, glyphG, width, height, currentByGeometry = new Map();
  const glyphPointCache = new Map();
  function glyphPoint(feature) {
    const name = feature.properties.name;
    if (glyphPointCache.has(name)) return glyphPointCache.get(name);
    const center = d3.geoCentroid(feature);
    if (d3.geoContains(feature, center)) { glyphPointCache.set(name, center); return center; }
    const [[minLon, minLat], [maxLon, maxLat]] = d3.geoBounds(feature);
    const target = projection(center);
    let best = null, bestDistance = Infinity;
    for (let yi = 0; yi <= 40; yi += 1) for (let xi = 0; xi <= 40; xi += 1) {
      const candidate = [minLon + (maxLon - minLon) * xi / 40, minLat + (maxLat - minLat) * yi / 40];
      if (!d3.geoContains(feature, candidate)) continue;
      const point = projection(candidate);
      const distance = (point[0] - target[0]) ** 2 + (point[1] - target[1]) ** 2;
      if (distance < bestDistance) { bestDistance = distance; best = candidate; }
    }
    const result = best || center;
    glyphPointCache.set(name, result);
    return result;
  }

  svg.append('defs').html(`<filter id="viz2-glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><pattern id="viz2-no-participation" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${token('--map-no-participation')}"/><path d="M0 0V6" stroke="${token('--border-subtle')}"/></pattern><pattern id="viz2-unmapped" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${token('--surface-panel')}"/><path d="M0 0L6 6M6 0L0 6" stroke="${token('--border-subtle')}"/></pattern>`);
  mapG = svg.append('g'); countryG = mapG.append('g'); glyphG = mapG.append('g');
  countryG.selectAll('path').data(mapGeo.features).join('path').attr('class','country').attr('tabindex','-1')
    .on('mouseenter focus', function(event,d){ const rec=getRecord(d); if(!rec)return; countryG.selectAll('.country').classed('peer-muted',true); d3.select(this).classed('peer-muted',false).classed('is-hovered',true); showTip(event,rec); })
    .on('mousemove', event=>positionTip(event)).on('mouseleave blur', function(){countryG.selectAll('.country').classed('peer-muted is-hovered',false);tooltip.hidden=true;})
    .on('click keydown', function(event,d){ if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return; event.preventDefault(); const rec=getRecord(d); if(rec) select(rec); });

  const zoom = d3.zoom().scaleExtent([1,8])
    .on('zoom', event=>{ mapG.attr('transform',event.transform); local.zoom=event.transform.k; updateCountryBorders(); renderGlyphs(); })
    .on('end', event=>{const t=event.transform;if(t.k<=1.001&&(Math.abs(t.x)>.5||Math.abs(t.y)>.5))svg.transition().duration(300).ease(d3.easeCubicOut).call(zoom.transform,d3.zoomIdentity);});
  svg.call(zoom);
  function updateCountryBorders(){const factor=1/Math.sqrt(local.zoom);svg.style('--v2-country-border',`${.9*factor}px`).style('--v2-country-hover-border',`${2.2*factor}px`).style('--v2-country-selected-border',`${2.8*factor}px`);}
  function getRecord(feature){ return currentByGeometry.get(feature.properties.name)?.[0]; }
  function metric(rec){ if(!rec)return null; const count=local.medal==='All'?rec.medals:rec[local.medal]; return local.mode==='efficiency' ? count/rec.athletes : count; }
  function activeRows(){ return records.filter(d=>d.year===state.activeYear && d.sport===local.sport && (local.continent==='All continents'||d.continent===local.continent)); }
  function firstMatch(rec){ return rec[local.first==='gold'?'first_gold_year':'first_medal_year']===state.activeYear; }
  function render(){
    renderGamesKpis();
    const rows=activeRows(); currentByGeometry=d3.group(rows,d=>d.geometry_name);
    const values=rows.map(metric).filter(Number.isFinite).sort(d3.ascending); const cap=d3.quantile(values,.95)||1;
    const efficiency=d3.scaleQuantize().domain([0,cap]).range(['--efficiency-1','--efficiency-2','--efficiency-3','--efficiency-4','--efficiency-5']);
    const tally=d3.scaleQuantize().domain([0,cap]).range(['--tally-1','--tally-1','--tally-3','--tally-4','--tally-5']);
    countryG.selectAll('.country').attr('d',path).attr('tabindex',d=>getRecord(d)?'0':'-1').attr('aria-label',d=>{const r=getRecord(d);return r?`${r.label}, ${state.activeYear}`:null;})
      .classed('has-data',d=>!!getRecord(d)).classed('first-hit',d=>{const r=getRecord(d);return local.mode==='first'&&r&&firstMatch(r);}).classed('first-medal',d=>{const r=getRecord(d);return local.mode==='first'&&r&&r.first_medal_year===state.activeYear;}).classed('first-gold',d=>{const r=getRecord(d);return local.mode==='first'&&r&&r.first_gold_year===state.activeYear;}).classed('is-selected',d=>getRecord(d)?.noc===local.selected)
      .transition().duration(380).attr('fill',d=>{const r=getRecord(d);if(!r)return 'url(#viz2-no-participation)';if(r.mapping_status==='unmapped')return 'url(#viz2-unmapped)';if(local.mode==='first')return token('--map-no-participation');const v=metric(r);if(!r.athletes)return token('--map-zero-medal');return Number.isFinite(v)?token((local.mode==='efficiency'?efficiency:tally)(Math.min(v,cap))):token('--map-zero-medal');});
    const host=rows[0]?.host||'No host data'; root.querySelector('[data-v2-host]').textContent=`${state.activeYear} ${host}`;
    root.querySelector('[data-v2-title]').textContent=local.mode==='first'?`${local.first==='gold'?'First gold':'First medal'} in ${state.activeYear}`:MODES[local.mode];
    root.querySelector('.viz2-legend').innerHTML=local.mode==='first'?`<strong>First achievement</strong><div class="legend-key"><i class="legend-fill neutral"></i>Not a milestone</div><div class="legend-key"><i class="legend-outline first-medal-key"></i>First medal</div><div class="legend-key"><i class="legend-outline first-gold-key"></i>First gold</div>`:`<strong>${MODES[local.mode]}</strong><div class="legend-key"><i class="legend-fill no-participation"></i>No participation</div><div class="legend-key"><i class="legend-fill zero-medal"></i>Participated, no medal</div><div class="legend-key"><div class="legend-ramp ${local.mode==='tally'?'tally-ramp':''}"></div><span>${local.mode==='efficiency'?'Medal efficiency: medals per athlete':'Medal tally'}</span></div><div class="legend-key"><i class="legend-fill unmapped"></i>Missing/unmapped geography</div>`;
    renderGlyphs(); syncControls(); if(local.selected) renderDetail(rows.find(d=>d.noc===local.selected)||records.find(d=>d.noc===local.selected&&d.year===state.activeYear&&d.sport===local.sport));
  }
  function renderGlyphs(){
    const rows=activeRows().filter(d=>(local.medal==='All'?d.medals:d[local.medal])>0); const shown=local.zoom>=1.8?rows:rows.sort((a,b)=>b.medals-a.medals).slice(0,24);
    const radius=d3.scaleSqrt().domain([0,d3.max(rows,d=>d.medals)||1]).range([3,14]); const pie=d3.pie().sort(null).value(d=>d.value), arc=d3.arc();
    const groups=glyphG.selectAll('.medal-glyph').data(local.pies?shown:[],d=>d.noc).join(enter=>{const g=enter.append('g').attr('class','medal-glyph');g.append('circle').attr('class','glyph-halo');g.append('circle').attr('class','glyph-hit').attr('r',16);return g;},update=>update,exit=>exit.remove())
      .attr('transform',d=>{const feature=mapGeo.features.find(f=>f.properties.name===d.geometry_name);const p=feature&&projection(glyphPoint(feature));return p?`translate(${p}) scale(${1/local.zoom})`:null;})
      .on('mouseenter focus', (event,d)=>showTip(event,d)).on('mousemove',positionTip).on('mouseleave blur',()=>tooltip.hidden=true).on('click',(e,d)=>{e.stopPropagation();select(d);});
    groups.each(function(rec){const r=radius(rec.medals), parts=['Gold','Silver','Bronze'].filter(m=>local.medal==='All'||m===local.medal).map(m=>({medal:m,value:rec[m]})).filter(x=>x.value);d3.select(this).selectAll('path').data(pie(parts),d=>d.data.medal).join('path').attr('d',arc.innerRadius(0).outerRadius(r)).attr('fill',d=>token(MEDAL_COLORS[d.data.medal])).attr('stroke',token('--surface-card')).attr('stroke-width',.9);d3.select(this).select('.glyph-halo').attr('r',r+2).attr('fill',token('--surface-card')).attr('stroke',token('--text-primary')).attr('stroke-width',.8);});
  }
  function showTip(event,r){tooltip.hidden=false;tooltip.innerHTML=`<h3>${esc(r.label)} <small>${r.noc}</small></h3><p>${r.year} · ${esc(r.host)}${r.sport!=='All sports'?` · ${esc(r.sport)}`:''}</p>${r.mapped_to?`<p class="detail-map-note">Mapped to modern-day ${esc(r.mapped_to)}</p>`:''}<div class="tt-grid"><span>Athletes</span><b>${r.athletes}</b><span>Gold / Silver / Bronze</span><b>${r.Gold} / ${r.Silver} / ${r.Bronze}</b><span>Efficiency</span><b>${r.efficiency.toFixed(3)}</b><span>Best sport</span><b>${esc(r.best_sport||'—')}</b></div>${local.mode==='first'?factsHtml(r):''}`;positionTip(event);}
  function positionTip(event){const x=Math.min(innerWidth-330,event.clientX+14), y=Math.min(innerHeight-220,event.clientY+14);tooltip.style.left=`${Math.max(8,x)}px`;tooltip.style.top=`${Math.max(8,y)}px`;}
  function factsHtml(r){const list=(type,label)=>{const y=r[`first_${type}_year`],events=r[`first_${type}_events`]||[];if(!y)return `<div class="detail-fact"><b>${label}</b><p>Not yet</p></div>`;return `<div class="detail-fact"><b>${label} · ${y}</b>${events.length?`<ul>${events.map(event=>`<li>${esc(event)}</li>`).join('')}</ul>`:'<p>Event unavailable</p>'}</div>`;};return `<div class="detail-facts">${list('medal','First medal')}${list('gold','First gold')}</div>`;}
  function select(r){local.selected=r.noc;renderDetail(r);render();}
  function renderDetail(r){
    if(!r){detail.innerHTML='<p class="detail-empty">No record in this scope.</p>';return;}
    const series=(historyIndex.get(r.noc)||[]).sort((a,b)=>a.year-b.year);
    const chart={width:300,height:128,left:35,right:8,top:16,bottom:29};
    const x=d3.scaleLinear().domain(d3.extent(payload.meta.years)).range([chart.left,chart.width-chart.right]);
    const y=d3.scaleLinear().domain([0,d3.max(series,d=>d.medals)||1]).nice().range([chart.height-chart.bottom,chart.top]);
    const yTicks=y.ticks(4).filter(Number.isInteger);
    const line=d3.line().x(d=>x(d.year)).y(d=>y(d.medals));
    detail.innerHTML=`<div class="detail-title"><h3>${flag(r.noc)} ${esc(r.label)}</h3><span>${r.noc}</span></div>${r.mapped_to?`<p class="detail-map-note">Mapped to modern-day ${esc(r.mapped_to)}</p>`:''}<div class="detail-metrics"><div><strong>${r.athletes}</strong><small>Athletes</small></div><div><strong>${r.medals}</strong><small>Medals</small></div><div><strong>${r.efficiency.toFixed(2)}</strong><small>Efficiency</small></div></div><p class="detail-copy">${r.Gold} gold · ${r.Silver} silver · ${r.Bronze} bronze<br>Best sport: ${esc(r.best_sport||'—')}</p>${local.mode==='first'?factsHtml(r):''}<figure class="detail-history"><figcaption>Total medals by Summer Games</figcaption><svg class="sparkline" viewBox="0 0 ${chart.width} ${chart.height}" role="img" aria-label="Line chart of total medals won by ${esc(r.label)} at each Summer Olympic Games"><g class="history-y-grid"></g><g class="history-x-axis"></g><g class="history-y-axis"></g><path class="history-line" d="${line(series)}"/></svg></figure>`;
    const history=d3.select(detail).select('.sparkline');
    history.select('.history-y-grid').attr('transform',`translate(${chart.left},0)`).call(d3.axisLeft(y).tickValues(yTicks).tickSize(-(chart.width-chart.left-chart.right)).tickFormat(''));
    history.select('.history-x-axis').attr('transform',`translate(0,${chart.height-chart.bottom})`).call(d3.axisBottom(x).ticks(4).tickFormat(d3.format('d')));
    history.select('.history-y-axis').attr('transform',`translate(${chart.left},0)`).call(d3.axisLeft(y).tickValues(yTicks).tickFormat(d3.format('d')));
    history.append('text').attr('class','history-x-label').attr('x',(chart.left+chart.width-chart.right)/2).attr('y',chart.height-1).attr('text-anchor','middle').text('Olympic year');
    history.append('text').attr('class','history-y-label').attr('transform','rotate(-90)').attr('x',-(chart.top+chart.height-chart.bottom)/2).attr('y',8).attr('text-anchor','middle').text('Total medals');
  }
  function syncControls(){root.querySelector('#v2-sport').value=local.sport;root.querySelector('#v2-continent').value=local.continent;root.querySelector('[data-v2-pies]').checked=local.pies;root.querySelector('[data-v2-first-control]').hidden=local.mode!=='first';root.querySelectorAll('[data-v2-medal] button').forEach(b=>b.classList.toggle('active',b.dataset.value===local.medal));root.querySelectorAll('[data-v2-mode] button').forEach(b=>b.classList.toggle('active',b.dataset.value===local.mode));root.querySelectorAll('[data-v2-first] button').forEach(b=>b.classList.toggle('active',b.dataset.value===local.first));}
  function resize(){const box=mapPanel.getBoundingClientRect();width=Math.max(320,box.width);height=root.querySelector('.viz2-map-wrap').clientHeight;svg.attr('viewBox',`0 0 ${width} ${height}`);zoom.extent([[0,0],[width,height]]).translateExtent([[0,0],[width,height]]);projection=d3.geoNaturalEarth1().fitExtent([[12,72],[width-12,height-30]],mapGeo);path=d3.geoPath(projection);render();}
  root.addEventListener('click',e=>{const b=e.target.closest('[data-value]');if(!b)return;const group=b.parentElement;if(group.hasAttribute('data-v2-medal'))local.medal=b.dataset.value;if(group.hasAttribute('data-v2-mode'))local.mode=b.dataset.value;if(group.hasAttribute('data-v2-first'))local.first=b.dataset.value;render();});
  root.querySelector('#v2-sport').addEventListener('change',e=>{local.sport=e.target.value;render();});root.querySelector('#v2-continent').addEventListener('change',e=>{local.continent=e.target.value;render();});root.querySelector('[data-v2-pies]').addEventListener('change',e=>{local.pies=e.target.checked;render();});
  root.querySelector('.viz2-collapse').addEventListener('click',e=>{const c=shell.classList.toggle('is-collapsed');e.currentTarget.textContent=c?'‹':'›';e.currentTarget.setAttribute('aria-expanded',String(!c));e.currentTarget.setAttribute('aria-label',c?'Expand details':'Collapse details');setTimeout(resize,50);});
  root.querySelector('.viz2-reset').addEventListener('click',()=>{Object.assign(local,{sport:'All sports',medal:'All',continent:'All continents',mode:'efficiency',first:'medal',pies:true,selected:null});detail.innerHTML='<p class="detail-empty">Select a country to pin its Olympic profile.</p>';setActiveYear(2016);stopPlay();svg.transition().duration(300).call(zoom.transform,d3.zoomIdentity);render();});
  onStateChange(render); new ResizeObserver(resize).observe(mapPanel); updateCountryBorders(); resize();
}
