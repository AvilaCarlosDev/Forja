// Forja is a fork of openGym. The upstream source strings and all sixteen locale packs say
// "openGym"; rewriting them would make every upstream merge conflict. Instead the product name
// is swapped once, where a string is about to be shown (i18n-core's t()).
//
// Left alone on purpose: paths ("Documents/openGym" is a real folder on the device), file
// names and hosts ("openGym.json", "opengym.example"), and anything that credits the upstream
// project by name goes through UPSTREAM, not through t().
export const BRAND = 'Forja'
export const UPSTREAM = 'openGym'

const NAME = /(?<![/\w.-])openGym(?![\w/]|\.\w)/g

export const brandText = s => (typeof s === 'string' && s.includes(UPSTREAM) ? s.replace(NAME, BRAND) : s)
