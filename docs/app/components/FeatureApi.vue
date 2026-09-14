<template>
  <!-- A real call against a real route, with the header the API actually takes —
       the tile claims everything the interface does is available over HTTP, so
       the example had better be something you could paste. -->
  <div
    class="ui api"
    aria-hidden="true"
  >
    <pre class="ui-code"><code><span class="ui-code__comment"># send a transfer</span>
curl <span class="ui-code__key">-X</span> POST $URL/api/transfers \
  <span class="ui-code__key">-H</span> "x-api-key: $KEY" \
  <span class="ui-code__key">-d</span> '{"to":["you@acme.de"]}'

<span class="ui-code__comment"># or ask an assistant</span>
/mcp → sendTransfer</code></pre>
  </div>
</template>
