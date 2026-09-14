<template>
  <section
    id="faq"
    class="section"
  >
    <div class="container">
      <SplitText
        as="h2"
        text="The most common questions answered"
        class="mb-4 max-w-lg text-3xl font-semibold tracking-tight text-dark text-balance sm:text-4xl lg:text-5xl"
      />

      <FaqItem
        v-for="(item, index) in faq"
        :key="index"
        :question="item.question"
        :answer="item.answer"
        :index="index"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
// The questions people actually arrive with, answered from the documentation
// rather than invented for the page — every claim below has a docs page behind
// it.
const faq = [
  {
    question: 'Is LokalTransfer really free?',
    answer:
      '<p>Yes. It is open source under the MIT licence — no paid tier, no size tiers, no seat limit and nothing held back. It costs you what the server it runs on costs.</p>'
  },
  {
    question: 'Where do the files go?',
    answer:
      '<p>Onto your own server, into a directory you choose, with the metadata in your own MySQL database. Nothing is uploaded anywhere else and there is no telemetry. The only traffic that leaves your machine is the mail it sends through your own SMTP server.</p>'
  },
  {
    question: 'What happens when a transfer expires?',
    answer:
      '<p>The link stops working immediately, and a scheduled sweep then deletes the files from disk and the rows from the database. "Deleted" is literal, not merely unreachable.</p><p>The default is 14 days; a sender can pick anything up to 90, or keep a transfer indefinitely. The sender gets a warning by e-mail the day before a transfer lapses.</p>'
  },
  {
    question: 'Can clients send files to me?',
    answer:
      '<p>Yes — that is the half an ordinary file host does not do. Add a client\'s address as a contact and they receive a one-time sign-in link and an upload form, with no account to create and no password to remember. They pick which team member the files go to.</p>'
  },
  {
    question: 'Do I need to set up a database?',
    answer:
      '<p>Not to get started. The Docker image carries its own MySQL, so a single <code>docker run</code> gives you a working instance with nothing else to install.</p><p>For anything long-lived a separate database is the better arrangement — it can be backed up, upgraded and monitored on its own schedule. Point <code>NUXT_MYSQL_HOST</code> at it and the built-in one never starts.</p>'
  },
  {
    question: 'How big can a transfer be?',
    answer:
      '<p>As big as your disk. Files stream to storage one request each rather than being buffered in memory, so a 20 GB transfer costs the server the same working set as a 20 MB one. The per-file limit is yours to set, and defaults to 2 GB.</p>'
  },
  {
    question: 'Can I put a password on a link?',
    answer:
      '<p>Yes. A protected transfer shows a recipient nothing but the prompt until the password is right — not the file names, not the sizes — so a link that gets forwarded is not on its own enough.</p>'
  },
  {
    question: 'Is there an API?',
    answer:
      '<p>Everything the interface does is available over HTTP with a scoped API key, and there is a built-in MCP server so an AI assistant can send transfers on your behalf. Keys can be read-only, and every one can be revoked at any time.</p>'
  },
  {
    question: 'Which languages are available?',
    answer:
      '<p>Ten: English, German, French, Spanish, Italian, Dutch, Polish, Ukrainian, Portuguese and Czech — the interface and every outbound e-mail alike, chosen at runtime with one variable. Each language is a single JSON file, and corrections are welcome as a pull request.</p>'
  }
]

// The FAQPage structured data Google's rich result expects, emitted once for
// the whole list. Written by hand rather than through an SEO module, which
// would carry a dependency this site has no other use for.
useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        'mainEntity': faq.map(item => ({
          '@type': 'Question',
          'name': item.question,
          'acceptedAnswer': {
            '@type': 'Answer',
            // Rich results want the answer as text, not markup.
            'text': item.answer.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          }
        }))
      })
    }
  ]
})
</script>
