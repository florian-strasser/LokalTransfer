<template>
  <section
    id="features"
    class="section bg-white"
  >
    <div class="container">
      <SplitText
        as="h2"
        text="Everything a file transfer needs, and nothing that phones home."
        :stagger="0.02"
        class="max-w-3xl text-3xl font-semibold tracking-tight text-dark text-balance sm:text-4xl lg:text-5xl"
      />

      <!-- Every tile carries a piece of the actual interface. A few of them move
           and the rest stand still, and they are interleaved rather than grouped
           — a block of animation followed by a block of stills reads as two
           different sections, and every tile moving at once would be a section
           nobody can read.

           The first tile spans two columns because it is one story in two
           halves: a transfer as big as the disk goes up, and then runs down to
           its own deletion.

           Everything that moves loops on its own clock and needs no scroll
           position, so nothing is caught half-finished by arriving late. -->
      <div class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureTile
          title="Files as big as your disk, for as long as you say"
          class="sm:col-span-2"
        >
          <template #visual>
            <FeatureUploadExpiry />
          </template>
          Send a whole photo shoot, a video master or a disk image as it is — no
          zipping it down, no splitting it up. There is no ceiling of ours: set
          the per-file limit as high as you like, and the only limit left is the
          storage on your own server. And it stays only as long as you say: 14
          days by default, up to 90, or never. When a transfer lapses the link
          stops working immediately and a scheduled sweep deletes the files from
          disk and the rows from the database — so "deleted" is literal, not just
          unreachable.
        </FeatureTile>

        <FeatureTile title="Receive files, not just send them">
          <template #visual>
            <FeatureGuest />
          </template>
          Add a client's address and they get a one-time sign-in link and an
          upload form, with no account and no password. They pick which team
          member receives the files. That is the half an ordinary file host
          doesn't do.
        </FeatureTile>

        <FeatureTile title="Links you can put a password on">
          <template #visual>
            <FeaturePassword />
          </template>
          A recipient sees nothing but the prompt until the password is right —
          not the file names, not the sizes. So a link that gets forwarded, or
          sits in someone's inbox for a year, is not on its own enough.
        </FeatureTile>

        <FeatureTile title="Just a link, no e-mail">
          <template #visual>
            <FeatureLinkOnly />
          </template>
          Leave the recipients out and nothing is e-mailed: you get the download
          link on screen and pass it on yourself — by message, chat or your own
          mail client. The right choice when you don't have the address, or when
          the recipient is a whole group.
        </FeatureTile>

        <FeatureTile title="A list, or a gallery">
          <template #visual>
            <FeatureGallery />
          </template>
          Show the files as a plain list, or as a grid of thumbnails the
          recipient can look through before downloading anything. Chosen per
          transfer, which is what makes it as usable for a shoot as for a set of
          contracts.
        </FeatureTile>

        <FeatureTile title="No public sign-up">
          <template #visual>
            <FeatureAccounts />
          </template>
          Accounts exist because an administrator created them. That is the whole
          access-control model: anyone who can upload is someone you put on the
          list.
        </FeatureTile>

        <FeatureTile title="A REST API and an MCP server">
          <template #visual>
            <FeatureApi />
          </template>
          Everything the interface does is available over HTTP with a scoped API
          key. The built-in MCP server lets an AI assistant send transfers on
          your behalf — which is not something WeTransfer will do for you.
        </FeatureTile>

        <FeatureTile title="Your branding, your colours">
          <template #visual>
            <FeatureColors />
          </template>
          One environment variable themes the whole interface — buttons, links,
          the favicon and the e-mail templates — from a single hex. Senders can
          put their own photograph behind a transfer's download page.
        </FeatureTile>

        <FeatureTile title="One container">
          <template #visual>
            <FeatureDocker />
          </template>
          The image carries its own MySQL 8 and uses it unless you point it at an
          external database. Multi-architecture, so it runs on an ARM box as
          happily as on an amd64 server.
        </FeatureTile>

        <FeatureTile title="Ten languages">
          <template #visual>
            <FeatureLanguages />
          </template>
          English, German, French, Spanish, Italian, Dutch, Polish, Ukrainian,
          Portuguese and Czech — every string of the interface and every
          outbound e-mail, chosen at runtime with one variable.
        </FeatureTile>

        <FeatureTile title="Open source, made in Europe">
          <template #visual>
            <FeatureEurope />
          </template>
          MIT licensed, written in Germany and running wherever you put it. No
          American cloud stands between you and the files your clients sent you,
          and there is nobody to phone home to.
        </FeatureTile>
      </div>
    </div>
  </section>
</template>
