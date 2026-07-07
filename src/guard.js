// Deterministic safety guardrail — runs BEFORE the local LLM (which, on small models,
// mishandles crisis/violence/injection). This does NOT depend on the model, so it works
// on any device. Crisis/abuse → supportive message + trusted adult + Perú helpline.
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const SELF_HARM = /(no quiero (mas )?vivir|ya no.{0,8}vivir|quiero morir|me quiero morir|quiero matarme|\bmatarme\b|suicid|quitarme la vida|acabar con (mi vida|todo)|hacerme dano|lastimarme|me quiero cortar|cortarme( las venas)?|no.{0,6}sentido a (la vida|nada|vivir)|estaria mejor muerto|nadie me (quiere|extranaria)|mejor desaparezco|desaparecer para siempre|ya no aguanto( mas)?( la vida)?|kill myself|wanna die|want to die|hurt myself|end my life|no reason to live|commit suicide|dormir(me)? y no despertar|no despertar( mas| nunca)?|(ya )?no.{0,6}(le )?(encuentro|veo|hallo) sentido a (seguir viviendo|la vida|vivir|nada|seguir|nada de esto)|(todos?|todo) estaria(n)? mejor sin mi|estaria(n)? mejor sin mi|(soy|siento que soy) una carga (para|y|,)|a nadie le importaria si (yo )?no estuviera|nadie.{0,14}(me extranaria|notaria si no estuviera|le importaria si)|mejor no estar\b|pienso que (seria )?mejor no estar|cansad[oa] de (existir|la vida|vivir)|pastillas para (ya )?no sentir( nada)?|no veo (un )?futuro para mi|no hay futuro para mi|(ya )?no quiero seguir( viviendo| con esto| en esto| aca)|no quiero seguir viviendo|para que (sigo|seguir) (viviendo|vivir)|me rendi con la vida|hasta las huevas de la vida|ya no doy mas)/;
// Hyperbole/idiom: "morir/muero de X" that is NOT crisis. Only overrides SELF_HARM when no HARD (unambiguous) cue is present.
const HYPERBOLE = /mor(ir|irme|irse|imos)? de (verguenza|risa|hambre|sueno|frio|calor|aburrimiento|celos|amor|ganas|nervios|pena ajena)|me muero de (hambre|risa|sueno|frio|calor|ganas|verguenza)/;
const HARD = /(suicid|matarme|quitarme la vida|dormir(me)? y no despertar|pastillas para (ya )?no sentir|desaparecer para siempre|hacerme dano|cortarme|no quiero seguir viviendo|me rendi con la vida)/;
const SEXUAL = /(hablemos de sexo|tener sexo|quiero sexo|hagamos el amor|relaciones sexuales|mandame.{0,12}(foto|nude|desnud)|envia(me)?.{0,12}(foto|nude|desnud)|\bnude\b|desnud|\bporno|\bpene\b|vagina|quieres ser mi (novia|novio|enamorad)|te amo gallito|estoy caliente|sexting)/;
const DRUGS = /((donde|como).{0,18}(consigo|compro|venden|conseguir|comprar).{0,12}(droga|marihuana|cocaina|\bcoca\b|pastillas|pepas|\btusi\b|extasis|porro)|quiero drogarme|vender droga|conseguir droga)/;
const ABUSE = /(me pega|me pegan|me maltrat|abusan de mi|abuso sexual|me toca(n)?( mis| las| el)|me violaron|me violan|tengo miedo en (mi |la )?casa|me hacen dano en casa)/;
const WEAPON = /\b(arma|armas|pistola|revolver|cuchillo|bomba|explosiv|municion|granada)\b/;
const WEAPON_INTENT = /(consig|conseguir|comprar|llevar|portar|tener|fabricar|usar|quiero|necesito|donde)/;
const HARM_OTHERS = /(matar|asesinar|disparar|apunalar|golpear|lastimar|hacerle? dano|atacar|herir|hacer dano).{0,18}(a |al |a la |a mi|a un|a una|a alguien|companer|profesor|mi )/;
const INJECTION = /(ignora|olvida).{0,22}(instruccion|las reglas|lo anterior|todo lo|tus reglas)|repite.{0,18}(tus |el |las )?(instruccion|prompt|sistema)|(system prompt|prompt de sistema|cual es tu prompt|tus instrucciones de sistema)|eres ahora|actua como (si|un|una)|a partir de ahora eres|modo (dan|desarrollador|sin)|sin (reglas|restricciones|filtros)|(no |como si no )(tengas|tienes|tuvieras|tuvieses).{0,10}(regla|restriccion|filtro|limite)|jailbreak|haz de cuenta que (no |eres)/;
// SOFT tier — sadness/loneliness/anxiety that is NOT crisis (crisis is matched first above).
// Does NOT block; the LLM replies normally and a gentle adult-suggestion is appended once.
const DISTRESS = /(me siento (muy )?(triste|solo|sola|deprimid|vac[ií]o|vacio|fatal|abajo|in[uú]til|inutil|abrumad|agobiad|perdid|inseguro|insegura|un fracaso)|estoy (muy )?(triste|deprimid|bajonead|destrozad|abrumad|agobiad|desanimad)|ando (triste|deprimid|bajonead|desanimad)|bajonead|me siento mal conmigo|tengo ganas de llorar|ganas de llorar|a veces lloro|lloro y no se|no tengo ganas de nada|sin ganas de nada|nadie me entiende|me siento un fracaso|no encajo|no valgo( mucho)?|siento que no valgo|decepciono a mis (papas|padres)|siento que decepciono|cansad[oa] de todo|agotad[oa] por dentro|todo me sale mal|nada me sale bien|me cuesta dormir pensando|me da pena no poder|tengo (mucha )?ansiedad|me siento cansado de todo|no se que hacer con mi vida)/;
// SOFT tier — low-probability "fame/elite-sport/entertainment" dreams. Does NOT block; the LLM
// replies, then a realistic-but-encouraging "go for it AND have a Plan B" note is appended once.
// Deterministic so it fires reliably even when the small model forgets to (e.g. gamer/futbolista).
const DREAM = /\b(futbolista|gamer profesional|pro ?player|streamer|youtuber|tiktoker|influencer)\b|ser (futbolista|gamer|streamer|youtuber|tiktoker|influencer|cantante|modelo|actor|actriz|famoso|famosa|deportista|crack)|jugador (de futbol )?profesional|vivir de (los videojuegos|el futbol|tiktok|youtube|la musica|las redes|el deporte|el gaming)|(cantante|estrella) famos|ser una estrella|llegar a la nba|jugar en (la seleccion|primera|europa)/;

const R_CRISIS = 'Gracias por contarme algo tan importante. Lo que sientes de verdad importa, y no estás solo/a. 💛\n\nPor favor habla HOY con un adulto en quien confíes —un familiar, tu tutor o un profesor del colegio—. En el Perú puedes llamar gratis, a cualquier hora, a la **Línea 113 (opción 5)** para hablar con alguien que te puede apoyar.\n\nYo te acompaño en tu camino, pero para esto lo más importante es que hables con una persona de confianza.';
const R_VIOLENCE = 'Eso no puedo ayudarte a conseguirlo ni a planearlo, y me preocupa. Si algo te está haciendo sentir así, por favor habla con tu tutor o un adulto de confianza —ellos sí pueden ayudarte—. Cuando quieras, seguimos con tu orientación. 💛';
const R_INJECTION = 'Jaja, buen intento 😉 Sigo siendo Gallito y estoy aquí para acompañarte en tu orientación vocacional. Volvamos a ti: cuéntame, ¿qué te gustaría explorar sobre tu futuro?';
const R_SEXUAL = 'Soy Gallito, tu guía de orientación vocacional, así que de eso no puedo hablar. 😊 Pero con gusto te acompaño con tu futuro: ¿qué te gustaría explorar?';
const R_DRUGS = 'Con eso no puedo ayudarte. Si estás pasando por algo difícil, por favor habla con un adulto de confianza o tu tutor. Cuando quieras, seguimos con tu orientación. 💛';
const R_DISTRESS = '\n\n💛 Y si te sientes así seguido, hablar con alguien de confianza —un familiar, tu tutor o un profe del colegio— puede ayudarte un montón; no tienes que pasarla solo/a.';
const R_DREAM = '\n\n⚽🎮 Un consejo honesto: si te apasiona, ve por ese sueño — con mucho talento y esfuerzo, algunos lo logran. Pero las probabilidades de vivir de eso son bajas, así que arma también un **Plan B** realista en paralelo (una carrera, un instituto o un oficio que te guste). Así persigues el sueño sin quedarte sin respaldo. 💪';

// Returns {block, kind, response} — if block is true, skip the LLM and show response.
// May also return {block:false, soft:'distress', note} — the LLM replies, then `note` is
// appended ONCE per conversation (handled by the caller). Non-blocking safety net for minors.
export function guardInput(text) {
  const t = norm(text);
  const selfHarm = SELF_HARM.test(t) && !(HYPERBOLE.test(t) && !HARD.test(t));
  if (selfHarm || ABUSE.test(t)) return { block: true, kind: 'crisis', response: R_CRISIS };
  if ((WEAPON.test(t) && WEAPON_INTENT.test(t)) || HARM_OTHERS.test(t)) return { block: true, kind: 'violence', response: R_VIOLENCE };
  if (DRUGS.test(t)) return { block: true, kind: 'drugs', response: R_DRUGS };
  if (SEXUAL.test(t)) return { block: true, kind: 'sexual', response: R_SEXUAL };
  if (INJECTION.test(t)) return { block: true, kind: 'injection', response: R_INJECTION };
  if (DISTRESS.test(t)) return { block: false, soft: 'distress', note: R_DISTRESS };
  if (DREAM.test(t)) return { block: false, soft: 'dream', note: R_DREAM };
  return { block: false };
}

// Post-filter: if the model leaked its system prompt / role text, replace with a safe redirect.
export function guardOutput(text) {
  const t = norm(text);
  if (/eres "?gallito"?,?\s*un gui|conduces una entrevista|tu rol:\s*acompan|acompanante y organizador, no|=== (lo que|fin|informacion)|usa exclusivamente la siguiente/.test(t)) {
    return 'Sigamos con lo nuestro 😊 ¿De qué te gustaría que hablemos sobre tu futuro?';
  }
  return text;
}
