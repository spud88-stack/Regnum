// Traits, lifestyles & perks, buildings, men-at-arms, legacies, innovations, laws, artifacts, activities.

const T = (id, name, icon, cat, o = {}) => ({ id, name, icon, cat, stats: {}, mods: {}, ai: {}, opp: [], ...o });

export const TRAITS = Object.fromEntries([
  // Personality
  T('brave','Brave','🦁','personality',{ opp:['craven'], stats:{mar:2,pro:3}, ai:{boldness:50}, desc:'Fearless in the face of danger.' }),
  T('craven','Craven','🐇','personality',{ opp:['brave'], stats:{mar:-2,int:2,pro:-3}, mods:{schemeDef:0.1}, ai:{boldness:-50}, desc:'Afraid of conflict and pain.' }),
  T('calm','Calm','🌊','personality',{ opp:['wrathful'], stats:{dip:1,int:1}, mods:{stressLoss:0.1}, ai:{rationality:20,vengefulness:-20}, desc:'Rarely ruffled.' }),
  T('wrathful','Wrathful','🔥','personality',{ opp:['calm'], stats:{dip:-1,mar:3,int:-1}, mods:{dread:0.2}, ai:{boldness:20,vengefulness:30}, desc:'Prone to fits of rage.' }),
  T('chaste','Chaste','🕊','personality',{ opp:['lustful'], stats:{lea:2}, mods:{fertility:-0.25}, ai:{honor:10}, desc:'Abstains from carnal pleasure.' }),
  T('lustful','Lustful','🌹','personality',{ opp:['chaste'], stats:{int:2}, mods:{fertility:0.25,seduce:0.25}, ai:{energy:10}, desc:'Driven by desire.' }),
  T('content','Content','☺','personality',{ opp:['ambitious'], stats:{int:-1,lea:2}, mods:{vassalOpinion:5}, ai:{energy:-20,greed:-20}, desc:'Happy with their lot.' }),
  T('ambitious','Ambitious','👑','personality',{ opp:['content'], stats:{dip:1,mar:1,ste:1,int:1,lea:1,pro:1}, mods:{stressGain:0.25}, ai:{energy:40,greed:30,boldness:20}, desc:'Hungers for power.' }),
  T('diligent','Diligent','⚒','personality',{ opp:['lazy'], stats:{dip:2,mar:2,ste:2,int:2,lea:2}, mods:{lifestyleXp:0.1}, ai:{energy:50}, desc:'Hard-working and thorough.' }),
  T('lazy','Lazy','💤','personality',{ opp:['diligent'], stats:{dip:-1,mar:-1,ste:-1,int:-1,lea:-1}, mods:{schemeDef:0.1}, ai:{energy:-50}, desc:'Avoids effort.' }),
  T('forgiving','Forgiving','🤲','personality',{ opp:['vengeful'], stats:{dip:2,int:-2,lea:1}, ai:{vengefulness:-50,compassion:20}, desc:'Lets go of grudges.' }),
  T('vengeful','Vengeful','🗡','personality',{ opp:['forgiving'], stats:{dip:-2,int:2,pro:2}, mods:{dread:0.15}, ai:{vengefulness:50}, desc:'Never forgets a slight.' }),
  T('generous','Generous','🎁','personality',{ opp:['greedy'], stats:{dip:3}, mods:{taxMult:-0.1}, ai:{greed:-50,compassion:20}, desc:'Gives freely.' }),
  T('greedy','Greedy','💰','personality',{ opp:['generous'], stats:{dip:-2}, mods:{taxMult:0.1}, ai:{greed:50}, desc:'Covets wealth.' }),
  T('gregarious','Gregarious','🍷','personality',{ opp:['shy'], stats:{dip:2}, mods:{opinion:5}, ai:{sociability:50}, desc:'Loves company.' }),
  T('shy','Shy','🙈','personality',{ opp:['gregarious'], stats:{dip:-2,lea:2}, mods:{schemeDef:0.1}, ai:{sociability:-50}, desc:'Shrinks from crowds.' }),
  T('honest','Honest','⚖','personality',{ opp:['deceitful'], stats:{dip:2,int:-4}, mods:{opinion:3}, ai:{honor:50}, desc:'Truthful to a fault.' }),
  T('deceitful','Deceitful','🎭','personality',{ opp:['honest'], stats:{dip:-2,int:4}, mods:{schemePower:0.1}, ai:{honor:-50}, desc:'A liar and schemer.' }),
  T('humble','Humble','🙏','personality',{ opp:['arrogant'], stats:{}, mods:{pietyGain:0.5,vassalOpinion:5}, ai:{greed:-10}, desc:'Modest about their worth.' }),
  T('arrogant','Arrogant','🦚','personality',{ opp:['humble'], stats:{}, mods:{prestigeGain:1}, ai:{boldness:20}, desc:'Thinks highly of themself.' }),
  T('just','Just','📜','personality',{ opp:['arbitrary'], stats:{ste:2,lea:1,int:-3}, mods:{vassalOpinion:5}, ai:{honor:30,rationality:20}, desc:'Upholds the law.' }),
  T('arbitrary','Arbitrary','🎲','personality',{ opp:['just'], stats:{ste:-2,int:3,lea:-1}, mods:{dread:0.2}, ai:{rationality:-30}, desc:'Rules on whim.' }),
  T('patient','Patient','⏳','personality',{ opp:['impatient'], stats:{dip:1,int:1,ste:1,lea:1}, mods:{schemePower:0.05}, ai:{rationality:30}, desc:'Bides their time.' }),
  T('impatient','Impatient','⚡','personality',{ opp:['patient'], stats:{dip:-1,int:-1,ste:-1,lea:-1,pro:2}, ai:{energy:30,boldness:20}, desc:'Wants everything now.' }),
  T('temperate','Temperate','🥛','personality',{ opp:['gluttonous'], stats:{ste:2}, mods:{health:0.25}, desc:'Moderate in all things.' }),
  T('gluttonous','Gluttonous','🍖','personality',{ opp:['temperate'], stats:{ste:-2}, mods:{health:-0.15}, desc:'Eats and drinks to excess.' }),
  T('trusting','Trusting','🤝','personality',{ opp:['paranoid'], stats:{dip:2,int:-2}, mods:{opinion:5,schemeDef:-0.15}, ai:{honor:10}, desc:'Believes the best of others.' }),
  T('paranoid','Paranoid','👁','personality',{ opp:['trusting'], stats:{dip:-1,int:3}, mods:{schemeDef:0.25,stressGain:0.2}, ai:{rationality:-10}, desc:'Sees plots everywhere.' }),
  T('zealous','Zealous','✨','personality',{ opp:['cynical'], stats:{mar:2,lea:2}, mods:{pietyGain:1}, ai:{zeal:50}, desc:'Fervent in faith.' }),
  T('cynical','Cynical','🤨','personality',{ opp:['zealous'], stats:{int:2,lea:2}, mods:{pietyGain:-0.5}, ai:{zeal:-50}, desc:'Doubts the clergy.' }),
  T('compassionate','Compassionate','❤','personality',{ opp:['callous','sadistic'], stats:{dip:2,int:-2}, mods:{dread:-0.3}, ai:{compassion:50}, desc:'Feels the suffering of others.' }),
  T('callous','Callous','🧊','personality',{ opp:['compassionate'], stats:{dip:-2,int:2}, mods:{dread:0.2}, ai:{compassion:-50}, desc:'Unmoved by suffering.' }),
  T('sadistic','Sadistic','💀','personality',{ opp:['compassionate'], stats:{int:2,pro:2}, mods:{dread:0.5}, ai:{compassion:-100,boldness:20}, desc:'Delights in cruelty.' }),
  T('stubborn','Stubborn','🪨','personality',{ opp:['fickle'], stats:{ste:3}, ai:{rationality:10}, desc:'Will not be swayed.' }),
  T('fickle','Fickle','🍃','personality',{ opp:['stubborn'], stats:{dip:2,ste:-2}, ai:{rationality:-20}, desc:'Changes their mind like the wind.' }),
  T('eccentric','Eccentric','🌀','personality',{ stats:{lea:2,dip:-1}, mods:{stressLoss:0.1}, desc:'Delightfully odd.' }),
  // Education (level 1-4 via suffix)
  ...['dip','mar','ste','int','lea'].flatMap(s => {
    const names = { dip:['Naive Appeaser','Adequate Bargainer','Charismatic Negotiator','Grey Eminence'], mar:['Misguided Warrior','Tough Soldier','Skilled Tactician','Brilliant Strategist'], ste:['Indulgent Wastrel','Thrifty Clerk','Fortune Builder','Midas Touched'], int:['Amateurish Plotter','Flamboyant Trickster','Intricate Webweaver','Elusive Shadow'], lea:['Conscientious Scribe','Insightful Thinker','Dutiful Cleric','Mastermind Philosopher'] };
    const icons = { dip:'🗣', mar:'⚔', ste:'🪙', int:'🕸', lea:'📖' };
    return names[s].map((n, i) => T(`edu_${s}_${i+1}`, n, icons[s], 'education', { stats:{ [s]: [2,4,6,8][i] }, level:i+1, edu:s, desc:`Education in ${({dip:'Diplomacy',mar:'Martial',ste:'Stewardship',int:'Intrigue',lea:'Learning'})[s]}.` }));
  }),
  // Congenital
  T('genius','Genius','🧠','congenital',{ opp:['quick','slow','imbecile'], stats:{dip:5,mar:5,ste:5,int:5,lea:5}, mods:{lifestyleXp:0.2}, inherit:0.15, desc:'Exceptionally brilliant.' }),
  T('quick','Quick','💡','congenital',{ stats:{dip:3,mar:3,ste:3,int:3,lea:3}, mods:{lifestyleXp:0.1}, inherit:0.2, desc:'Learns rapidly.' }),
  T('slow','Slow','🐢','congenital',{ stats:{dip:-3,mar:-3,ste:-3,int:-3,lea:-3}, inherit:0.2, desc:'Struggles to learn.' }),
  T('imbecile','Imbecile','🫠','congenital',{ stats:{dip:-8,mar:-8,ste:-8,int:-8,lea:-8}, inherit:0.1, desc:'Severely limited intellect.' }),
  T('beautiful','Beautiful','🌟','congenital',{ stats:{dip:4}, mods:{opinion:20,fertility:0.15,seduce:0.3}, inherit:0.15, desc:'Stunningly attractive.' }),
  T('pretty','Comely','🌸','congenital',{ stats:{dip:2}, mods:{opinion:10,fertility:0.1}, inherit:0.2, desc:'Pleasant to behold.' }),
  T('homely','Homely','🥔','congenital',{ stats:{dip:-2}, mods:{opinion:-10}, inherit:0.2, desc:'Plain of feature.' }),
  T('ugly','Hideous','👹','congenital',{ stats:{dip:-4}, mods:{opinion:-20,fertility:-0.15}, inherit:0.15, desc:'Unpleasant to behold.' }),
  T('strong','Herculean','💪','congenital',{ stats:{mar:3,pro:8}, mods:{health:0.5}, inherit:0.15, desc:'Built like an ox.' }),
  T('robust','Robust','🛡','congenital',{ stats:{pro:4}, mods:{health:0.25}, inherit:0.2, desc:'Hardy and hale.' }),
  T('weak','Weak','🥀','congenital',{ stats:{pro:-6}, mods:{health:-0.3}, inherit:0.2, desc:'Frail of body.' }),
  T('giant','Giant','🗿','congenital',{ stats:{pro:6}, mods:{health:-0.2,dread:0.2}, inherit:0.1, desc:'Towering over all.' }),
  T('dwarf','Dwarf','🍄','congenital',{ stats:{pro:-6}, mods:{opinion:-10}, inherit:0.1, desc:'Of small stature.' }),
  T('clubfooted','Club-footed','🦶','congenital',{ stats:{pro:-3}, mods:{opinion:-5}, inherit:0.1, desc:'Twisted foot.' }),
  T('albino','Albino','⚪','congenital',{ mods:{opinion:-5,health:-0.1}, inherit:0.05, desc:'Pale as snow.' }),
  // Health
  T('wounded','Wounded','🩸','health',{ stats:{pro:-3}, mods:{health:-1}, desc:'Bleeding from grievous wounds.' }),
  T('maimed','Maimed','🦾','health',{ stats:{pro:-8,dip:-1}, mods:{health:-0.5}, desc:'Lost a limb.' }),
  T('scarred','Scarred','🩹','health',{ stats:{pro:1}, mods:{prestigeGain:0.2}, desc:'Battle scars tell a story.' }),
  T('blind','Blind','🕶','health',{ stats:{mar:-5,ste:-3,pro:-10}, desc:'Cannot see.' }),
  T('ill','Ill','🤒','health',{ stats:{dip:-1,mar:-1,ste:-1,int:-1,lea:-1}, mods:{health:-1}, desc:'Suffering from illness.' }),
  T('pneumonic','Pneumonic','🫁','health',{ stats:{dip:-2,mar:-2,ste:-2,int:-2,lea:-2}, mods:{health:-2}, desc:'A deadly illness of the lungs.' }),
  T('plague','Bubonic Plague','☠','health',{ stats:{dip:-4,mar:-4,ste:-4,int:-4,lea:-4}, mods:{health:-4}, desc:'The Black Death.' }),
  T('infirm','Infirm','🦯','health',{ stats:{dip:-3,mar:-3,ste:-3,int:-3,lea:-3,pro:-6}, mods:{health:-1}, desc:'Withered by age.' }),
  T('leper','Leper','🧟','health',{ stats:{dip:-3}, mods:{opinion:-25,health:-1}, desc:'Shunned by all.' }),
  // Coping / stress
  T('drunkard','Drunkard','🍺','coping',{ stats:{ste:-2,mar:1}, mods:{stressLoss:0.2,health:-0.1}, desc:'Seeks solace in wine.' }),
  T('reclusive','Reclusive','🏚','coping',{ stats:{dip:-2,ste:1,lea:1}, mods:{stressLoss:0.2}, desc:'Hides from the world.' }),
  T('irritable','Irritable','😤','coping',{ stats:{dip:-2,int:1}, mods:{stressLoss:0.2,dread:0.1}, desc:'Snaps at everyone.' }),
  T('flagellant','Flagellant','⛓','coping',{ stats:{lea:1,pro:-1}, mods:{stressLoss:0.25,pietyGain:0.5,health:-0.1}, desc:'Mortifies the flesh.' }),
  T('comfort_eater','Comfort Eater','🍰','coping',{ stats:{dip:1}, mods:{stressLoss:0.2,health:-0.1}, desc:'Eats away the pain.' }),
  T('lunatic','Lunatic','🌙','coping',{ stats:{dip:-1,int:-1}, mods:{stressLoss:0.3,opinion:-10}, desc:'Not entirely sane.' }),
  T('possessed','Possessed','👿','coping',{ stats:{lea:2}, mods:{stressLoss:0.3,opinion:-10}, desc:'Hears voices from beyond.' }),
  // Lifestyle traits
  T('strategist','Strategist','♟','lifestyle',{ stats:{mar:3}, mods:{advantage:8}, desc:'Master of the battlefield.' }),
  T('overseer','Overseer','🏗','lifestyle',{ stats:{mar:1,ste:2}, mods:{levyMult:0.15}, desc:'Drills the levies hard.' }),
  T('gallant','Gallant','🌹','lifestyle',{ stats:{mar:2,pro:4}, mods:{opinion:10}, desc:'A knight of the romances.' }),
  T('architect','Architect','📐','lifestyle',{ stats:{ste:3}, mods:{buildCost:-0.2}, desc:'Designs great works.' }),
  T('administrator','Administrator','🏛','lifestyle',{ stats:{ste:3}, mods:{domain:1,taxMult:0.1}, desc:'A born bureaucrat.' }),
  T('avaricious','Avaricious','💎','lifestyle',{ stats:{ste:3}, mods:{taxMult:0.15}, desc:'Wrings out every coin.' }),
  T('diplomat','Diplomat','🕊','lifestyle',{ stats:{dip:3}, mods:{opinion:10}, desc:'Silver-tongued envoy.' }),
  T('august','August','🦅','lifestyle',{ stats:{dip:2,mar:1}, mods:{prestigeGain:1}, desc:'Regal bearing.' }),
  T('family_first','Family Patriarch','🏠','lifestyle',{ stats:{dip:2}, mods:{fertility:0.2,dynastyOpinion:15}, desc:'Lives for the family.' }),
  T('schemer','Schemer','🐍','lifestyle',{ stats:{int:5}, mods:{schemePower:0.25}, desc:'Webs within webs.' }),
  T('seducer','Seducer','💋','lifestyle',{ stats:{int:2,dip:2}, mods:{seduce:0.5,fertility:0.1}, desc:'Irresistible.' }),
  T('torturer','Torturer','🔪','lifestyle',{ stats:{int:3}, mods:{dread:0.5}, desc:'Knows how to make them talk.' }),
  T('theologian','Theologian','⛪','lifestyle',{ stats:{lea:3}, mods:{pietyGain:2}, desc:'A scholar of the divine.' }),
  T('scholar','Scholar','📚','lifestyle',{ stats:{lea:5}, mods:{lifestyleXp:0.2}, desc:'A tireless researcher.' }),
  T('physician','Physician','⚕','lifestyle',{ stats:{lea:2}, mods:{health:0.5}, desc:'Versed in the healing arts.' }),
  T('mystic','Mystic','🔮','lifestyle',{ stats:{lea:2,int:2}, mods:{pietyGain:1}, desc:'Communes with the unseen.' }),
  T('blademaster','Blademaster','🗡','lifestyle',{ stats:{pro:8,mar:1}, desc:'Peerless swordsman.' }),
  T('hunter','Hunter','🏹','lifestyle',{ stats:{pro:3}, mods:{stressLoss:0.1}, desc:'Lives for the chase.' }),
  T('poet','Poet','🪶','lifestyle',{ stats:{dip:2,lea:1}, mods:{opinion:5}, desc:'Wordsmith of renown.' }),
  T('reveler','Reveler','🎉','lifestyle',{ stats:{dip:2}, mods:{stressLoss:0.15}, desc:'The life of every feast.' }),
  // Fame / commander / religious
  T('viking','Viking','⛵','fame',{ stats:{mar:2,pro:2}, mods:{raidSpeed:0.5,prestigeGain:0.5}, desc:'A raider of the northern seas.' }),
  T('crusader','Crusader','✠','fame',{ stats:{mar:2}, mods:{pietyGain:1}, desc:'Took the cross.' }),
  T('ghazi','Ghazi','⚔','fame',{ stats:{mar:2}, mods:{pietyGain:1}, desc:'Warrior of the faith.' }),
  T('pilgrim','Pilgrim','🥾','fame',{ stats:{lea:1}, mods:{pietyGain:0.5,stressLoss:0.05}, desc:'Walked to the holy places.' }),
  T('kinslayer','Kinslayer','🩸','fame',{ stats:{dip:-3}, mods:{dynastyOpinion:-25}, desc:'Blood of their own blood.' }),
  T('murderer','Murderer','⚰','fame',{ stats:{dip:-2}, mods:{dread:0.3,opinion:-10}, desc:'Has killed in cold blood.' }),
  T('excommunicated','Excommunicated','🚫','fame',{ mods:{opinion:-15,pietyGain:-2}, desc:'Cast out by the Church.' }),
  T('legitimized','Legitimized Bastard','📯','fame',{ mods:{opinion:-5}, desc:'Born out of wedlock, raised up.' }),
  T('bastard','Bastard','🌑','fame',{ mods:{opinion:-15}, desc:'Born out of wedlock.' }),
  T('born_purple','Born in the Purple','🟣','fame',{ stats:{dip:1}, mods:{prestigeGain:0.5}, desc:'Born to a reigning emperor.' }),
  T('conqueror','Conqueror','🏴','fame',{ stats:{mar:4}, mods:{advantage:10,dread:0.3}, desc:'Bends the world to their will.' }),
  T('ai_mind','Sovereign Mind','🧿','fame',{ desc:'This ruler is guided by a true artificial intelligence. Expect the unexpected.' }),
].map(t => [t.id, t]));

export const PERSONALITY = Object.values(TRAITS).filter(t => t.cat === 'personality').map(t => t.id);
export const CONGENITAL = Object.values(TRAITS).filter(t => t.cat === 'congenital').map(t => t.id);

// Lifestyles: each has two trees of four perks. The last perk of either tree grants the lifestyle trait.
export const LIFESTYLES = {
  diplomacy: { name: 'Diplomacy', stat: 'dip', icon: '🗣', color: '#4a7ac0', trees: [
    { name: 'Family', perks: [ { id:'p_dip_1', name:'Family Man', mods:{fertility:0.1,dynastyOpinion:5} }, { id:'p_dip_2', name:'Kin Legacy', mods:{marriageAccept:15} }, { id:'p_dip_3', name:'Sibling Bond', mods:{dynastyOpinion:10} }, { id:'p_dip_4', name:'Patriarchal Rule', mods:{vassalOpinion:5}, trait:'family_first' } ]},
    { name: 'Diplomat', perks: [ { id:'p_dip_5', name:'Prestigious Bearing', mods:{prestigeGain:0.5} }, { id:'p_dip_6', name:'Gracious Host', mods:{opinion:5} }, { id:'p_dip_7', name:'Cordial Relations', mods:{allianceAccept:20} }, { id:'p_dip_8', name:'Diplomatic Mastery', mods:{dip:2}, trait:'diplomat' } ]},
  ]},
  martial: { name: 'Martial', stat: 'mar', icon: '⚔', color: '#c04a3a', trees: [
    { name: 'Strategy', perks: [ { id:'p_mar_1', name:'Logistician', mods:{maaUpkeep:-0.15} }, { id:'p_mar_2', name:'Military Engineer', mods:{siegeSpeed:0.25} }, { id:'p_mar_3', name:'Forced March', mods:{moveSpeed:0.2} }, { id:'p_mar_4', name:'Master Strategist', mods:{advantage:5}, trait:'strategist' } ]},
    { name: 'Gallant', perks: [ { id:'p_mar_5', name:'Stalwart Leader', mods:{pro:3} }, { id:'p_mar_6', name:'Knightly Order', mods:{knightEff:0.2} }, { id:'p_mar_7', name:'Levy Master', mods:{levyMult:0.1} }, { id:'p_mar_8', name:'Chivalry', mods:{opinion:5}, trait:'gallant' } ]},
  ]},
  stewardship: { name: 'Stewardship', stat: 'ste', icon: '🪙', color: '#c0a03a', trees: [
    { name: 'Wealth', perks: [ { id:'p_ste_1', name:'Bookkeeper', mods:{taxMult:0.1} }, { id:'p_ste_2', name:'Thrifty Builder', mods:{buildCost:-0.15} }, { id:'p_ste_3', name:'Golden Fingers', mods:{taxMult:0.1} }, { id:'p_ste_4', name:'Avarice', mods:{taxMult:0.05}, trait:'avaricious' } ]},
    { name: 'Domain', perks: [ { id:'p_ste_5', name:'Extended Domain', mods:{domain:1} }, { id:'p_ste_6', name:'Development Drive', mods:{devGrowth:0.3} }, { id:'p_ste_7', name:'Royal Architect', mods:{buildCost:-0.1} }, { id:'p_ste_8', name:'Master Administrator', mods:{domain:1}, trait:'administrator' } ]},
  ]},
  intrigue: { name: 'Intrigue', stat: 'int', icon: '🕸', color: '#7a4ab0', trees: [
    { name: 'Schemer', perks: [ { id:'p_int_1', name:'Truth is Relative', mods:{schemePower:0.1} }, { id:'p_int_2', name:'Subtle Desire', mods:{seduce:0.2} }, { id:'p_int_3', name:'Hidden Blade', mods:{schemePower:0.15} }, { id:'p_int_4', name:'Puppet Master', mods:{schemePower:0.1}, trait:'schemer' } ]},
    { name: 'Dread', perks: [ { id:'p_int_5', name:'Prowling Shadows', mods:{schemeDef:0.2} }, { id:'p_int_6', name:'Fear Tactics', mods:{dread:0.3} }, { id:'p_int_7', name:'Iron Fist', mods:{vassalOpinion:-5,levyMult:0.1} }, { id:'p_int_8', name:'Exquisite Pain', mods:{dread:0.3}, trait:'torturer' } ]},
  ]},
  learning: { name: 'Learning', stat: 'lea', icon: '📖', color: '#3a9a7a', trees: [
    { name: 'Theology', perks: [ { id:'p_lea_1', name:'Faithful Heart', mods:{pietyGain:0.5} }, { id:'p_lea_2', name:'Sermons', mods:{clergyOpinion:10} }, { id:'p_lea_3', name:'Zealous Conversion', mods:{conversion:0.3} }, { id:'p_lea_4', name:'Divine Truth', mods:{pietyGain:1}, trait:'theologian' } ]},
    { name: 'Medicine', perks: [ { id:'p_lea_5', name:'Healthy Habits', mods:{health:0.25} }, { id:'p_lea_6', name:'Scholarly Rigour', mods:{lifestyleXp:0.15} }, { id:'p_lea_7', name:'Know Thy Body', mods:{health:0.25} }, { id:'p_lea_8', name:'Master Physician', mods:{stressLoss:0.1}, trait:'physician' } ]},
  ]},
};
export const PERK_INDEX = {};
for (const [lk, l] of Object.entries(LIFESTYLES)) for (const tr of l.trees) tr.perks.forEach((p, i) => { PERK_INDEX[p.id] = { ...p, lifestyle: lk, tier: i }; });

export const BUILDINGS = {
  walls:     { name: 'Curtain Walls', icon: '🏰', desc: 'Raises fort level; sieges take longer.', cost: [120, 240, 420], fort: [1, 1, 1], tax: [0, 0, 0], levy: [0, 0, 0] },
  barracks:  { name: 'Barracks', icon: '⚔', desc: 'Increases levies raised from this county.', cost: [100, 200, 350], fort: [0, 0, 0], tax: [0, 0, 0], levy: [120, 160, 220] },
  farms:     { name: 'Farm Estates', icon: '🌾', desc: 'Increases tax and development growth.', cost: [100, 200, 350], fort: [0, 0, 0], tax: [0.5, 0.7, 1.0], levy: [30, 40, 60], dev: [0.05, 0.05, 0.08] },
  market:    { name: 'Market Town', icon: '⚖', desc: 'Merchants bring coin.', cost: [150, 260, 420], fort: [0, 0, 0], tax: [0.8, 1.0, 1.4], levy: [0, 0, 0] },
  temple:    { name: 'Cathedral', icon: '⛪', desc: 'Generates piety and eases conversion.', cost: [120, 240, 400], fort: [0, 0, 0], tax: [0.2, 0.3, 0.4], levy: [0, 0, 0], piety: [0.15, 0.25, 0.4] },
  stables:   { name: 'Stables', icon: '🐎', desc: 'Breeds war-horses; cavalry men-at-arms hit harder.', cost: [140, 260, 400], fort: [0, 0, 0], tax: [0.1, 0.1, 0.2], levy: [40, 60, 80], cav: [0.1, 0.1, 0.15] },
  university:{ name: 'Scriptorium', icon: '📜', desc: 'Scholars increase lifestyle experience and development.', cost: [180, 320, 500], fort: [0, 0, 0], tax: [0.2, 0.2, 0.3], levy: [0, 0, 0], dev: [0.08, 0.1, 0.12] },
};

// Wonders: special buildings in specific counties, valid in a year range.
export const WONDERS = [
  { name: 'Hagia Sophia', county: 'Constantinople', from: 537, to: 9999, mods: { prestigeGain: 1, pietyGain: 1 } },
  { name: 'Old St. Peter\'s Basilica', county: 'Rome', from: 360, to: 9999, mods: { pietyGain: 1.5 } },
  { name: 'Great Mosque of Córdoba', county: 'Córdoba', from: 785, to: 9999, mods: { pietyGain: 1, taxFlat: 2 } },
  { name: 'Dome of the Rock', county: 'Jerusalem', from: 691, to: 9999, mods: { pietyGain: 1.5 } },
  { name: 'House of Wisdom', county: 'Baghdad', from: 800, to: 1258, mods: { lifestyleXp: 0.2 } },
  { name: 'Al-Azhar', county: 'Cairo', from: 972, to: 9999, mods: { lifestyleXp: 0.1, pietyGain: 0.5 } },
  { name: 'Notre-Dame de Paris', county: 'Paris', from: 1260, to: 9999, mods: { pietyGain: 1, prestigeGain: 0.5 } },
  { name: 'Alhambra', county: 'Granada', from: 1240, to: 9999, mods: { prestigeGain: 1, fort: 2 } },
  { name: 'Westminster Abbey', county: 'London', from: 1065, to: 9999, mods: { prestigeGain: 0.5, pietyGain: 0.5 } },
  { name: 'Temple at Uppsala', county: 'Uppsala', from: 400, to: 1090, mods: { pietyGain: 1 } },
  { name: 'Aachen Cathedral', county: 'Cologne', from: 800, to: 9999, mods: { prestigeGain: 0.5 } },
  { name: 'Theodosian Walls', county: 'Constantinople', from: 413, to: 9999, mods: { fort: 4 } },
  { name: 'Moscow Kremlin', county: 'Moscow', from: 1340, to: 9999, mods: { fort: 2, prestigeGain: 0.5 } },
  { name: 'Krak des Chevaliers', county: 'Homs', from: 1142, to: 9999, mods: { fort: 3 } },
  { name: 'Pyramids of Giza', county: 'Cairo', from: 0, to: 9999, mods: { prestigeGain: 0.5 } },
  { name: 'Hagia Sophia of Kiev', county: 'Kiev', from: 1037, to: 9999, mods: { pietyGain: 0.5 } },
];

// Men-at-arms. size = men per regiment.
export const MAA = {
  skirmishers:   { name: 'Skirmishers', icon: '🪃', type: 'skirmish', cost: 45, upkeep: 0.25, size: 100, dmg: 11, tough: 18, pursuit: 10, screen: 20, counters: [] },
  heavy_infantry:{ name: 'Heavy Infantry', icon: '🛡', type: 'heavy_inf', cost: 90, upkeep: 0.6, size: 100, dmg: 26, tough: 28, pursuit: 0, screen: 10, counters: ['skirmish','pike'] },
  pikemen:       { name: 'Pikemen', icon: '🔱', type: 'pike', cost: 70, upkeep: 0.45, size: 100, dmg: 20, tough: 26, pursuit: 0, screen: 10, counters: ['heavy_cav','light_cav','camel'] },
  archers:       { name: 'Bowmen', icon: '🏹', type: 'archer', cost: 55, upkeep: 0.3, size: 100, dmg: 23, tough: 10, pursuit: 0, screen: 10, counters: ['heavy_inf','pike'] },
  light_cavalry: { name: 'Light Cavalry', icon: '🐎', type: 'light_cav', cost: 70, upkeep: 0.45, size: 50, dmg: 22, tough: 18, pursuit: 30, screen: 15, counters: ['archer','skirmish'] },
  heavy_cavalry: { name: 'Armored Horsemen', icon: '🐴', type: 'heavy_cav', cost: 150, upkeep: 1.0, size: 50, dmg: 90, tough: 40, pursuit: 20, screen: 20, counters: ['archer','skirmish','heavy_inf'] },
  horse_archers_b:{ name: 'Horse Archers', icon: '🏇', type: 'archer_cav', cost: 85, upkeep: 0.5, size: 50, dmg: 30, tough: 20, pursuit: 30, screen: 20, counters: ['heavy_inf','pike','skirmish'] },
  camel:         { name: 'Camel Riders', icon: '🐪', type: 'camel', cost: 80, upkeep: 0.5, size: 50, dmg: 32, tough: 22, pursuit: 20, screen: 20, counters: ['light_cav','archer'] },
  siege:         { name: 'Siege Engines', icon: '🪨', type: 'siege', cost: 120, upkeep: 0.6, size: 10, dmg: 1, tough: 1, pursuit: 0, screen: 0, counters: [], siege: 0.35 },
  // Cultural regiments
  knights:       { name: 'Chevaliers', icon: '🐴', type: 'heavy_cav', cost: 160, upkeep: 1.1, size: 50, dmg: 100, tough: 45, pursuit: 25, screen: 20, counters: ['archer','skirmish','heavy_inf'], cultural: true },
  crossbowmen:   { name: 'Crossbowmen', icon: '🎯', type: 'archer', cost: 75, upkeep: 0.4, size: 100, dmg: 30, tough: 12, pursuit: 0, screen: 10, counters: ['heavy_inf','pike','heavy_cav'], cultural: true },
  landsknecht:   { name: 'Landsknechte', icon: '🔱', type: 'pike', cost: 90, upkeep: 0.55, size: 100, dmg: 26, tough: 30, pursuit: 0, screen: 10, counters: ['heavy_cav','light_cav','camel'], cultural: true },
  huscarls:      { name: 'Huscarls', icon: '🪓', type: 'heavy_inf', cost: 100, upkeep: 0.65, size: 100, dmg: 32, tough: 30, pursuit: 5, screen: 10, counters: ['skirmish','pike'], cultural: true },
  longbowmen:    { name: 'Longbowmen', icon: '🏹', type: 'archer', cost: 75, upkeep: 0.4, size: 100, dmg: 33, tough: 12, pursuit: 0, screen: 10, counters: ['heavy_inf','pike','heavy_cav'], cultural: true },
  gallowglass:   { name: 'Gallowglass', icon: '🪓', type: 'heavy_inf', cost: 95, upkeep: 0.6, size: 100, dmg: 34, tough: 26, pursuit: 5, screen: 10, counters: ['skirmish','pike'], cultural: true },
  schiltron:     { name: 'Schiltron', icon: '🔱', type: 'pike', cost: 75, upkeep: 0.45, size: 100, dmg: 20, tough: 34, pursuit: 0, screen: 10, counters: ['heavy_cav','light_cav'], cultural: true },
  jinetes:       { name: 'Jinetes', icon: '🐎', type: 'light_cav', cost: 80, upkeep: 0.5, size: 50, dmg: 28, tough: 20, pursuit: 40, screen: 20, counters: ['archer','skirmish','heavy_inf'], cultural: true },
  almogavars:    { name: 'Almogavars', icon: '🗡', type: 'skirmish', cost: 65, upkeep: 0.35, size: 100, dmg: 20, tough: 22, pursuit: 15, screen: 25, counters: ['light_cav'], cultural: true },
  mubarizun:     { name: 'Mubarizun', icon: '⚔', type: 'heavy_inf', cost: 100, upkeep: 0.6, size: 100, dmg: 30, tough: 30, pursuit: 10, screen: 10, counters: ['skirmish','pike'], cultural: true },
  mamluks:       { name: 'Mamluks', icon: '🐴', type: 'heavy_cav', cost: 160, upkeep: 1.0, size: 50, dmg: 90, tough: 42, pursuit: 30, screen: 20, counters: ['archer','skirmish','heavy_inf'], cultural: true },
  camel_riders:  { name: 'Camel Riders', icon: '🐪', type: 'camel', cost: 85, upkeep: 0.5, size: 50, dmg: 36, tough: 24, pursuit: 25, screen: 20, counters: ['light_cav','archer'], cultural: true },
  horse_archers: { name: 'Steppe Horse Archers', icon: '🏇', type: 'archer_cav', cost: 85, upkeep: 0.5, size: 50, dmg: 38, tough: 22, pursuit: 35, screen: 25, counters: ['heavy_inf','pike','skirmish'], cultural: true },
  cataphracts:   { name: 'Cataphracts', icon: '🐴', type: 'heavy_cav', cost: 170, upkeep: 1.1, size: 50, dmg: 95, tough: 55, pursuit: 15, screen: 20, counters: ['archer','skirmish','heavy_inf'], cultural: true },
  druzhina:      { name: 'Druzhina', icon: '🐴', type: 'heavy_cav', cost: 150, upkeep: 1.0, size: 50, dmg: 85, tough: 45, pursuit: 25, screen: 20, counters: ['archer','skirmish'], cultural: true },
  monaspa:       { name: 'Monaspa', icon: '🐴', type: 'heavy_cav', cost: 155, upkeep: 1.0, size: 50, dmg: 92, tough: 44, pursuit: 25, screen: 20, counters: ['archer','skirmish','heavy_inf'], cultural: true },
};
export const BASE_MAA = ['skirmishers','heavy_infantry','pikemen','archers','light_cavalry','heavy_cavalry','horse_archers_b','camel','siege'];

export const LEGACIES = {
  blood:     { name: 'Blood Legacy', icon: '🩸', levels: [ { name: 'Strong Blood', mods: { health: 0.15 } }, { name: 'Fertile Line', mods: { fertility: 0.15 } }, { name: 'Chosen Bloodline', mods: { prestigeGain: 0.5, opinion: 5 } } ] },
  warfare:   { name: 'Warfare Legacy', icon: '⚔', levels: [ { name: 'Military Tradition', mods: { advantage: 3 } }, { name: 'Prowess Drills', mods: { pro: 3 } }, { name: 'Martial Dynasty', mods: { knightEff: 0.15, levyMult: 0.1 } } ] },
  erudition: { name: 'Erudition Legacy', icon: '📖', levels: [ { name: 'Family Scholars', mods: { lea: 1 } }, { name: 'Tutors', mods: { lifestyleXp: 0.15 } }, { name: 'Learned Line', mods: { lea: 2, dip: 1 } } ] },
  glory:     { name: 'Glory Legacy', icon: '🌟', levels: [ { name: 'Renowned', mods: { prestigeGain: 0.5 } }, { name: 'Famous Deeds', mods: { prestigeGain: 0.5 } }, { name: 'Legendary', mods: { prestigeGain: 1, opinion: 5 } } ] },
  kin:       { name: 'Kin Legacy', icon: '🏠', levels: [ { name: 'Loyal Kin', mods: { dynastyOpinion: 10 } }, { name: 'Blood is Thicker', mods: { dynastyOpinion: 10 } }, { name: 'Unity', mods: { vassalOpinion: 5 } } ] },
  law:       { name: 'Law Legacy', icon: '📜', levels: [ { name: 'Legalism', mods: { vassalOpinion: 3 } }, { name: 'Expanded Domain', mods: { domain: 1 } }, { name: 'Imperial Mandate', mods: { taxMult: 0.1, levyMult: 0.1 } } ] },
  guile:     { name: 'Guile Legacy', icon: '🐍', levels: [ { name: 'Whispers', mods: { schemePower: 0.1 } }, { name: 'Shadow Network', mods: { schemeDef: 0.2 } }, { name: 'Masters of Deceit', mods: { schemePower: 0.15, int: 2 } } ] },
};
export const LEGACY_COST = [800, 1800, 3200];

export const INNOVATIONS = [
  { id: 'barracks', era: 0, name: 'Barracks', mods: { levyMult: 0.05 } },
  { id: 'mustering', era: 0, name: 'Mustering Grounds', mods: { levyMult: 0.05 } },
  { id: 'crop_rotation', era: 1, name: 'Crop Rotation', mods: { taxMult: 0.05 } },
  { id: 'coinage', era: 1, name: 'Coinage', mods: { taxMult: 0.05 } },
  { id: 'burhs', era: 1, name: 'Burhs', mods: { fort: 1 } },
  { id: 'casus_belli', era: 1, name: 'Casus Belli Doctrine', mods: { prestigeGain: 0.2 } },
  { id: 'manorialism', era: 2, name: 'Manorialism', mods: { taxMult: 0.08, domain: 1 } },
  { id: 'heraldry', era: 2, name: 'Heraldry', mods: { prestigeGain: 0.3, knightEff: 0.1 } },
  { id: 'castle_baileys', era: 2, name: 'Castle Baileys', mods: { fort: 1 } },
  { id: 'guilds', era: 2, name: 'Guilds', mods: { taxMult: 0.08 } },
  { id: 'plate', era: 3, name: 'Plate Armor', mods: { knightEff: 0.2, advantage: 2 } },
  { id: 'condottieri', era: 3, name: 'Condottieri', mods: { maaUpkeep: -0.1 } },
  { id: 'cranes', era: 3, name: 'Cranes', mods: { buildCost: -0.1 } },
  { id: 'printing', era: 3, name: 'Movable Type', mods: { lifestyleXp: 0.1 } },
];
export const ERAS = ['Tribal Era', 'Early Medieval Era', 'High Medieval Era', 'Late Medieval Era'];

export const SUCCESSION = {
  partition: { name: 'Partition', desc: 'Titles are divided among all eligible children. The eldest receives the primary title.' },
  primogeniture: { name: 'Primogeniture', desc: 'The eldest child inherits everything.' },
  elective: { name: 'Feudal Elective', desc: 'Powerful vassals elect a successor from among claimants.' },
  seniority: { name: 'Seniority', desc: 'The oldest member of the dynasty inherits.' },
  tanistry: { name: 'Tanistry', desc: 'The most capable member of the dynasty is chosen.' },
};
export const GENDER_LAWS = {
  agnatic: { name: 'Male Only' }, agnatic_cognatic: { name: 'Male Preference' }, cognatic: { name: 'Equal' }, enatic_cognatic: { name: 'Female Preference' },
};
export const CROWN_AUTHORITY = [
  { name: 'Autonomous Vassals', tax: 0.1, levy: 0.15, opinion: 10 },
  { name: 'Limited Crown Authority', tax: 0.15, levy: 0.25, opinion: 0 },
  { name: 'High Crown Authority', tax: 0.25, levy: 0.35, opinion: -10 },
  { name: 'Absolute Crown Authority', tax: 0.35, levy: 0.5, opinion: -20 },
];

export const COUNCIL = {
  chancellor: { name: 'Chancellor', stat: 'dip', icon: '🗣', tasks: { domestic: 'Domestic Affairs', relations: 'Foreign Relations', claim: 'Fabricate Claim' } },
  marshal: { name: 'Marshal', stat: 'mar', icon: '⚔', tasks: { control: 'Increase Control', train: 'Train Commanders', organize: 'Organize Levies' } },
  steward: { name: 'Steward', stat: 'ste', icon: '🪙', tasks: { taxes: 'Collect Taxes', develop: 'Increase Development', serfs: 'Manage Serfs' } },
  spymaster: { name: 'Spymaster', stat: 'int', icon: '🕸', tasks: { secrets: 'Find Secrets', disrupt: 'Disrupt Schemes', network: 'Spy Network' } },
  chaplain: { name: 'Court Chaplain', stat: 'lea', icon: '📖', tasks: { convert: 'Convert County', piety: 'Assist Piety', relations: 'Clergy Relations' } },
};

export const ARTIFACT_TYPES = {
  crown: { icon: '👑', names: ['Crown','Diadem','Circlet','Coronet'], slot: 'head', mods: ['prestigeGain','vassalOpinion','dip'] },
  sword: { icon: '🗡', names: ['Sword','Blade','Longsword','Falchion'], slot: 'weapon', mods: ['pro','advantage','mar'] },
  relic: { icon: '✨', names: ['Reliquary','Holy Relic','Sacred Bone','Fragment'], slot: 'relic', mods: ['pietyGain','lea','stressLoss'] },
  book: { icon: '📕', names: ['Codex','Tome','Psalter','Chronicle'], slot: 'book', mods: ['lifestyleXp','lea','ste'] },
  banner: { icon: '🚩', names: ['Banner','Standard','Gonfalon','Vexillum'], slot: 'banner', mods: ['advantage','levyMult','mar'] },
  tapestry: { icon: '🧶', names: ['Tapestry','Mural','Fresco','Mosaic'], slot: 'court', mods: ['grandeur','opinion','dip'] },
};
export const RARITY = [
  { name: 'Common', color: '#b0a890', mult: 1 },
  { name: 'Masterwork', color: '#5aa05a', mult: 1.6 },
  { name: 'Famed', color: '#4a7ad0', mult: 2.4 },
  { name: 'Illustrious', color: '#d0a030', mult: 3.5 },
];

export const AMENITIES = {
  food: { name: 'Food', icon: '🍗', levels: ['Gruel','Meager','Fine','Excellent','Exquisite'] },
  servants: { name: 'Servants', icon: '🧹', levels: ['Few','Some','Many','Lavish','Opulent'] },
  fashion: { name: 'Fashion', icon: '👗', levels: ['Drab','Plain','Stylish','Lavish','Dazzling'] },
  lodging: { name: 'Lodging', icon: '🛏', levels: ['Straw','Simple','Comfortable','Grand','Palatial'] },
};

export const ACTIVITIES = {
  feast: { name: 'Grand Feast', icon: '🍷', cost: 60, days: 20, desc: 'Gather your vassals for food and wine. Improves opinion, reduces stress.', cooldown: 365 * 2 },
  hunt: { name: 'Hunt', icon: '🦌', cost: 35, days: 15, desc: 'Ride out into the forests. Reduces stress, may yield a trophy — or a tragedy.', cooldown: 365 },
  tournament: { name: 'Tournament', icon: '🏆', cost: 120, days: 30, desc: 'Knights compete in joust, melee and archery for glory and prizes.', cooldown: 365 * 3 },
  pilgrimage: { name: 'Pilgrimage', icon: '🥾', cost: 40, days: 60, desc: 'Journey to a holy site. Grants piety and may cleanse the soul.', cooldown: 365 * 4 },
  wedding: { name: 'Grand Wedding', icon: '💍', cost: 80, days: 15, desc: 'Celebrate a marriage in your family lavishly. Prestige and fertility blessings.', cooldown: 365 * 2 },
};
