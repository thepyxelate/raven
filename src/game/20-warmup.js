/* ---- shader warm-up: compile every location and race prop before they are needed ---- */
async function warmup() {
  try {
    for (const id of ['strip', 'coast', 'rain']) if (!ENVS[id]) { ENVS[id] = buildStreet(id); ENVS[id].group.visible = false; }
    ensureRival(RIVAL_BASE); ensureTraffic();
    const extras = [rivalRig, trafficRig.body, trafficRig.dark, trafficRig.tail, flames[0], smoke[0]];
    for (const id of Object.keys(ENVS)) {
      if (race.active || roam.active) return;
      for (const [k, v] of Object.entries(ENVS)) v.group.visible = k === id;
      extras.forEach((o) => { o.visible = true; });
      const keepEnv = scene.environment; scene.environment = ENVS[id].env;
      const shadowWas = ENVS[id].sun.castShadow; ENVS[id].sun.castShadow = qLevel !== 'low';
      const p = renderer.compileAsync(scene, camera);
      extras.forEach((o) => { o.visible = false; });
      ENVS[id].sun.castShadow = shadowWas;
      for (const [k, v] of Object.entries(ENVS)) v.group.visible = k === loc;
      scene.environment = keepEnv;
      await p;
    }
  } catch (e) { /* warm-up is best effort */ }
  if (!race.active && !roam.active) setLocation(loc);
}
