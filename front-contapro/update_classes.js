const fs = require('fs');

const files = [
  "f:/Proyectos/ContaPRO/front-contapro/src/app/[locale]/(dashboard)/expenses/page.tsx",
  "f:/Proyectos/ContaPRO/front-contapro/src/app/[locale]/(dashboard)/expenses/new/page.tsx",
  "f:/Proyectos/ContaPRO/front-contapro/src/app/[locale]/(dashboard)/expenses/[id]/DetailEditable.tsx",
  "f:/Proyectos/ContaPRO/front-contapro/src/app/[locale]/(dashboard)/expenses/[id]/page.tsx"
];

const replacements = [
  [/bg-zinc-900\/50/g, 'bg-white/5 backdrop-blur-md'],
  [/bg-zinc-900\/30/g, 'bg-white/5 backdrop-blur-md'],
  [/bg-zinc-800\/50/g, 'bg-white/10'],
  [/bg-zinc-800\/30/g, 'bg-white/5'],
  [/hover:bg-zinc-800\/30/g, 'hover:bg-white/5'],
  [/hover:bg-zinc-800/g, 'hover:bg-white/10'],
  [/bg-zinc-800/g, 'bg-white/10'],
  [/bg-zinc-500\/10/g, 'bg-white/5'],
  [/bg-muted/g, 'bg-white/5'],
  
  [/border-zinc-800\/50/g, 'border-white/10'],
  [/border-zinc-800/g, 'border-white/10'],
  [/border-zinc-700/g, 'border-white/10'],
  [/border-zinc-500\/20/g, 'border-white/10'],
  [/border-zinc-500/g, 'border-white/20'],
  [/border-border/g, 'border-white/10'],

  [/ring-zinc-800\/50/g, 'ring-white/10'],
  [/ring-zinc-800/g, 'ring-white/10'],
  [/ring-zinc-700/g, 'ring-white/20'],
  [/ring-zinc-500\/20/g, 'ring-white/10'],
  [/ring-zinc-500/g, 'ring-white/20'],
  [/ring-border/g, 'ring-white/10'],
  
  [/text-zinc-600/g, 'text-white/50'],
  [/text-zinc-500/g, 'text-white/50'],
  [/text-zinc-400/g, 'text-white/60'],
  [/text-zinc-300/g, 'text-white'],
  [/text-foreground/g, 'text-white'],
  [/text-zinc-900/g, 'text-black'],

  [/rounded-xl/g, 'rounded-2xl'],
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  replacements.forEach(([regex, replacement]) => {
    content = content.replace(regex, replacement);
  });
  fs.writeFileSync(file, content);
  console.log('Updated ' + file);
});
