import { onStateChange, state } from '../main.js';

const FAMILY_COLORS = {
  Aquatics: '#168AAD',
  Combat: '#D1495B',
  Team: '#7B61A8',
  Racquet: '#E07A5F',
  Cycling: '#2A9D8F',
  'Artistic-Precision': '#C48A3A',
  Other: '#64748B',
};
const cancelled = new Set([1916, 1940, 1944]);
const NODE_RADIUS = 6;
const LINK_PADDING = 5;
const LABEL_BG_PADDING_X = 4;
const LABEL_BG_PADDING_Y = 2;
const esc = (value) =>
  String(value ?? '?').replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]),
  );

// Load the sport-tree data and render the interactive programme hierarchy.
export async function loadViz3() {
  const root = document.querySelector('#viz3-root');
  if (!root) return;
  const data = await (await fetch('public/data/viz3_sport_tree.json')).json();
  root.innerHTML =
    `<div class="viz-action-toolbar viz3-toolbar"><button type="button" class="viz3-reset">Collapse all</button></div><div class="viz3-shell"><section class="viz3-chart-panel" aria-label="Olympic sport family tree"><div class="viz3-banner" role="status"></div><div class="viz3-year-subtitle" aria-live="polite"></div><div class="viz3-legend" aria-label="Sport family legend"></div><div class="viz3-tree-wrap"><svg class="viz3-svg" role="img" aria-label="Olympic programme hierarchy"></svg></div></section><aside class="viz3-side" aria-label="Selected sport details"><button class="viz3-collapse" type="button" aria-label="Collapse details" aria-expanded="true"></button><section class="viz3-detail" aria-live="polite"><p class="detail-empty">Select a sport to see its programme history.</p></section></aside></div>`;
  const shell = root.querySelector('.viz3-shell'),
    svg = d3.select(root.querySelector('.viz3-svg')),
    banner = root.querySelector('.viz3-banner'),
    detail = root.querySelector('.viz3-detail');
  const legend = d3.select(root.querySelector('.viz3-legend'));
  data.meta.families.forEach((f) =>
    legend.append('span').attr('class', 'viz3-legend-item').html(
      `<i style="background:${FAMILY_COLORS[f] || FAMILY_COLORS.Other}"></i>${esc(f)}`,
    )
  );
  const hierarchy = d3.hierarchy(data.tree), tree = d3.tree().nodeSize([24, 220]);
  let selected = null;
  const collapseFamilies = () =>
    hierarchy.children?.forEach((node) => {
      node._children = node.children || node._children;
      node.children = null;
    });
  collapseFamilies();
  const linkHorizontal = d3.linkHorizontal().x((d) => d.y).y((d) => d.x);
  const linkPoint = (node, direction) => ({
    x: node.x,
    // Keep the path outside the node circle, plus a small visual gutter.
    y: node.y + direction * (NODE_RADIUS + LINK_PADDING),
  });
  const addLabelBackground = (node, label) => {
    const box = label.node().getBBox();
    node.insert('rect', () => label.node()).attr('class', 'viz3-label-bg').attr(
      'x',
      box.x - LABEL_BG_PADDING_X,
    ).attr('y', box.y - LABEL_BG_PADDING_Y).attr(
      'width',
      box.width + LABEL_BG_PADDING_X * 2,
    ).attr('height', box.height + LABEL_BG_PADDING_Y * 2).attr('rx', 2);
  };
  const toggleNode = (node) => {
    const next = node.children ? null : node._children;
    if (next && node.depth === 1 && hierarchy.children) {
      hierarchy.children.forEach((other) => {
        if (other !== node) {
          other._children = other.children || other._children;
          other.children = null;
        }
      });
    }
    node._children = node.children;
    node.children = next;
    draw(true);
  };
  function renderDetail(node) {
    selected = node;
    const d = node.data,
      stat = d.yearlyStats[String(state.activeYear)],
      gapText = d.gaps.length ? d.gaps.map((g) => `${g[0]}-${g[1]}`).join(', ') : 'None';
    detail.innerHTML = `<div class="detail-title"><h3>${esc(d.name)}</h3><span>${
      esc(node.parent.data.name)
    }</span></div><div class="detail-metrics"><div><strong>${d.firstYear}</strong><small>First year</small></div><div><strong>${
      stat?.nocCount ?? 0
    }</strong><small>NOCs in ${state.activeYear} (raw count)</small></div><div><strong>${
      stat ? `${(stat.womenPct * 100).toFixed(1)}%` : '-'
    }</strong><small>Women's share</small></div></div><div class="detail-facts"><div class="detail-fact"><b>Programme status</b><p>${
      d.status === 'removed'
        ? 'removed from programme'
        : d.status === 'reinstated'
        ? 'reinstated after gap'
        : 'active'
    }${
      d.lastYear ? ` - last seen ${d.lastYear}` : ''
    }</p></div><div class="detail-fact"><b>Programme gaps</b><p>${gapText}</p></div></div>`;
  }
  function draw(animate = false) {
    const width = Math.max(620, root.querySelector('.viz3-chart-panel').clientWidth - 32),
      height = Math.max(240, hierarchy.leaves().length * 32 + 80);
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('height', height);
    tree.size([height - 56, Math.max(280, width - 280)]);
    tree(hierarchy);
    svg.selectAll('*').remove();
    const g = svg.append('g').attr('transform', 'translate(100,32)').style(
      'opacity',
      animate ? 0 : 1,
    );
    if (animate) g.transition().duration(300).style('opacity', 1);
    g.selectAll('.viz3-link').data(hierarchy.links()).join('path').attr('class', 'viz3-link').attr(
      'd',
      (d) => linkHorizontal({
        source: linkPoint(d.source, 1),
        target: linkPoint(d.target, -1),
      }),
    );
    g.selectAll('.viz3-node').data(hierarchy.descendants()).join('g').attr(
      'class',
      (d) => `viz3-node ${d.children || d._children ? 'is-branch' : 'is-leaf'}`,
    ).attr('transform', (d) => `translate(${d.y},${d.x})`).each(function (d) {
      const n = d3.select(this);
      if (d.children || d._children) {
        n.append('circle').attr('class', 'viz3-branch-dot').attr('r', NODE_RADIUS);
        const label = n.append('text').attr('class', 'viz3-family-label').attr('x', 0).attr(
          'y',
          -(NODE_RADIUS + LINK_PADDING + 1),
        ).attr('text-anchor', 'middle').text(
          `${d.data.name} [${d._children ? '+' : '-'}]`,
        ).attr('tabindex', 0).attr('role', 'button').attr(
          'aria-expanded',
          String(Boolean(d.children)),
        ).on('click', () => toggleNode(d)).on('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleNode(d);
          }
        });
        addLabelBackground(n, label);
      } else {
        const color = FAMILY_COLORS[d.parent.data.name] || FAMILY_COLORS.Other,
          stat = d.data.yearlyStats[String(state.activeYear)],
          debuted = state.activeYear >= d.data.firstYear;
        n.classed('is-selected', selected === d).style('opacity', debuted ? .95 : .28).on(
          'click',
          () => renderDetail(d),
        ).on('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') renderDetail(d);
        }).attr('tabindex', 0).attr('aria-label', `${d.data.name}, ${d.data.status}`);
        n.append('circle').attr('class', 'viz3-leaf-dot').attr('r', NODE_RADIUS).attr(
          'fill',
          d.data.status === 'active' ? color : 'none',
        ).attr('stroke', color).attr('stroke-width', d.data.status === 'reinstated' ? 3 : 1.6);
        const label = n.append('text').attr('x', NODE_RADIUS + LINK_PADDING).attr(
          'dy',
          '.35em',
        ).text(d.data.name);
        addLabelBackground(n, label);
      }
    });
    root.querySelector('.viz3-year-subtitle').textContent =
      `Programme composition in ${state.activeYear}`;
    const cancelledNow = cancelled.has(state.activeYear);
    root.querySelector('.viz3-chart-panel').classList.toggle('is-cancelled', cancelledNow);
    banner.textContent = cancelledNow
      ? `Games cancelled - ${state.activeYear === 1916 ? 'WWI' : 'WWII'}`
      : '';
    if (selected) renderDetail(selected);
  }
  root.querySelector('.viz3-reset').addEventListener('click', () => {
    collapseFamilies();
    draw(true);
  });
  root.querySelector('.viz3-collapse').addEventListener('click', (e) => {
    const c = shell.classList.toggle('is-collapsed');
    e.currentTarget.classList.toggle('is-collapsed', c);
    e.currentTarget.setAttribute('aria-expanded', String(!c));
    e.currentTarget.setAttribute('aria-label', c ? 'Expand details' : 'Collapse details');
    setTimeout(() => draw(true), 30);
  });
  onStateChange(draw);
  new ResizeObserver(draw).observe(root.querySelector('.viz3-chart-panel'));
  draw();
}
