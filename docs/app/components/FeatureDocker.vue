<template>
  <!-- The whole install, which is the tile's claim: one command, no database to
       provision first. This is the command from the README. -->
  <div
    class="ui dck"
    aria-hidden="true"
  >
    <pre class="ui-code"><code><span class="ui-code__comment"># database included</span>
docker run <span class="ui-code__key">-d</span> \
  <span class="ui-code__key">-p</span> 3000:3000 \
  <span class="ui-code__key">-v</span> lt:/var/lib/mysql \
  florianstrasser/lokaltransfer

<span class="ui-code__comment"># or bring your own</span>
  <span class="ui-code__key">-e</span> NUXT_MYSQL_HOST=db.internal</code></pre>
  </div>
</template>
