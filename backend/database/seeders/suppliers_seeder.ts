import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Company from '#models/company'
import Supplier from '#models/supplier'

/**
 * Generates fake supplier test data for the demo company, scoped to
 * Pernambuco (PE). Always inserts 80 records — does NOT clear what's already
 * there. Run only in dev/test environments.
 *
 * Distribution:
 *  - ~50% CPF (PF) / ~50% CNPJ (PJ)
 *  - ~60% mercadoria (goods) / ~40% serviço (service)
 *  - ~85% ativos / ~15% inativos
 *  - Cidades, bairros, CEPs e DDDs reais de PE
 */
export default class SuppliersSeeder extends BaseSeeder {
  /** Skip the production run. Only runs in dev/test. */
  static environment = ['development', 'testing']

  async run() {
    const company = await Company.query().where('slug', 'empresa-demo').first()
    if (!company) {
      console.log('[suppliers_seeder] empresa demo não encontrada; rode main_seeder primeiro.')
      return
    }

    // Offset the seed by the current row count so a second run produces
    // different CPFs/CNPJs (no algorithmic collision in practice, but cheap
    // insurance against accidental dup rows).
    const existing = await Supplier.query().where('company_id', company.id).count('* as total')
    const offset = Number(existing[0].$extras.total ?? 0)

    const records = Array.from({ length: 80 }, (_, i) => buildSupplier(company.id, i + offset))
    await Supplier.createMany(records)

    console.log(
      `[suppliers_seeder] 80 fornecedores PE cadastrados na empresa "${company.slug}" (já tinha ${offset}).`
    )
  }
}

// ---------------------------------------------------------------------------
// Geração de dados
// ---------------------------------------------------------------------------

/** Cidades PE + DDD + faixa de CEP (prefixo de 5 dígitos) usada na cidade. */
const PE_CITIES: Array<{ city: string; areaCode: '81' | '87'; cepPrefix: string; neighborhoods: string[] }> = [
  { city: 'Recife', areaCode: '81', cepPrefix: '50000', neighborhoods: ['Boa Viagem', 'Pina', 'Casa Forte', 'Espinheiro', 'Graças', 'Aflitos', 'Boa Vista', 'Madalena', 'Torre', 'Cordeiro', 'Várzea', 'Bongi', 'Imbiribeira', 'Encruzilhada', 'Casa Amarela'] },
  { city: 'Olinda', areaCode: '81', cepPrefix: '53000', neighborhoods: ['Bairro Novo', 'Casa Caiada', 'Carmo', 'Rio Doce', 'Jardim Atlântico', 'Peixinhos'] },
  { city: 'Jaboatão dos Guararapes', areaCode: '81', cepPrefix: '54000', neighborhoods: ['Piedade', 'Candeias', 'Prazeres', 'Cavaleiro', 'Curado'] },
  { city: 'Paulista', areaCode: '81', cepPrefix: '53400', neighborhoods: ['Janga', 'Pau Amarelo', 'Maranguape', 'Nossa Senhora do Ó'] },
  { city: 'Cabo de Santo Agostinho', areaCode: '81', cepPrefix: '54500', neighborhoods: ['Centro', 'Garapu', 'Charneca', 'Pontezinha'] },
  { city: 'Camaragibe', areaCode: '81', cepPrefix: '54750', neighborhoods: ['Timbi', 'Tabatinga', 'Aldeia', 'Vila da Fábrica'] },
  { city: 'Caruaru', areaCode: '81', cepPrefix: '55000', neighborhoods: ['Maurício de Nassau', 'Petrópolis', 'Universitário', 'Indianópolis', 'São Francisco'] },
  { city: 'Petrolina', areaCode: '87', cepPrefix: '56300', neighborhoods: ['Centro', 'Areia Branca', 'Atrás da Banca', 'José e Maria', 'Antônio Cassimiro'] },
  { city: 'Garanhuns', areaCode: '87', cepPrefix: '55290', neighborhoods: ['Heliópolis', 'Magano', 'Boa Vista', 'José Maria de Melo'] },
  { city: 'Vitória de Santo Antão', areaCode: '81', cepPrefix: '55600', neighborhoods: ['Centro', 'Livramento', 'Cajá', 'Matriz'] },
  { city: 'Igarassu', areaCode: '81', cepPrefix: '53600', neighborhoods: ['Centro', 'Cruz de Rebouças', 'Nova Cruz'] },
  { city: 'Santa Cruz do Capibaribe', areaCode: '81', cepPrefix: '55190', neighborhoods: ['Centro', 'Bela Vista', 'São Cristóvão'] },
  { city: 'Serra Talhada', areaCode: '87', cepPrefix: '56900', neighborhoods: ['Centro', 'AABB', 'São Cristóvão'] },
  { city: 'Arcoverde', areaCode: '87', cepPrefix: '56500', neighborhoods: ['Centro', 'São Cristóvão', 'São Geraldo'] },
  { city: 'Goiana', areaCode: '81', cepPrefix: '55900', neighborhoods: ['Centro', 'Carmelitas', 'Sítios Velhos'] },
]

const FIRST_NAMES = [
  'Antônio', 'Carlos', 'João', 'José', 'Pedro', 'Marcos', 'Lucas', 'Rafael', 'Fernando', 'Eduardo',
  'Bruno', 'Diego', 'Felipe', 'Gabriel', 'Henrique', 'Igor', 'Leonardo', 'Mateus', 'Paulo', 'Rodrigo',
  'Maria', 'Ana', 'Juliana', 'Camila', 'Patrícia', 'Fernanda', 'Larissa', 'Beatriz', 'Carla', 'Daniela',
  'Letícia', 'Mariana', 'Natália', 'Renata', 'Sabrina', 'Tatiana', 'Vanessa', 'Bianca', 'Cristina', 'Eliane',
]

const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Costa', 'Pereira', 'Rodrigues', 'Almeida', 'Nascimento',
  'Carvalho', 'Araújo', 'Gomes', 'Martins', 'Rocha', 'Ribeiro', 'Alves', 'Monteiro', 'Mendes', 'Barros',
  'Cavalcanti', 'Cavalcante', 'Bezerra', 'Maranhão', 'de Andrade', 'Brito', 'Correia', 'Lins', 'Tavares', 'Wanderley',
]

const COMPANY_PREFIXES = [
  'Distribuidora', 'Comercial', 'Indústria', 'Serviços', 'Manutenção', 'Construtora',
  'Transportadora', 'Atacado', 'Importadora', 'Auto Peças', 'Mecânica', 'Eletromecânica',
  'Refrigeração', 'Engenharia', 'Soluções', 'Tecnologia',
]

const COMPANY_THEMES = [
  'Nordeste', 'do Frevo', 'Pernambucana', 'Capibaribe', 'Boa Vista', 'Sertão',
  'Litoral', 'Recife', 'Olinda', 'Caruaru', 'Petrolina', 'Garanhuns', 'do Agreste',
  'Tropical', 'Atlântica', 'da Mata', 'Real', 'Aliança', 'Líder', 'Global',
]

const COMPANY_SUFFIXES = ['Ltda', 'ME', 'EIRELI', 'S/A', 'Comércio Ltda']

const NAME_PREFIXES_PF = ['', '', '', '', '', 'MEI ', 'MEI ']

function buildSupplier(companyId: number, index: number) {
  // Mistura determinística mas variada
  const seed = index + 1
  const isPj = seed % 2 === 0
  const type = (seed * 7) % 5 < 3 ? 'goods' : 'service' // ~60% goods
  const isActive = (seed * 11) % 100 < 85 // ~85% active

  const cityInfo = PE_CITIES[seed % PE_CITIES.length]
  const neighborhood = cityInfo.neighborhoods[(seed * 3) % cityInfo.neighborhoods.length]

  const taxId = isPj ? generateCnpj(seed) : generateCpf(seed)
  const name = isPj ? buildCompanyName(seed) : buildPersonName(seed)
  const contactName = isPj ? buildPersonName(seed * 13 + 7) : null

  const phone = (seed * 5) % 4 === 0 ? null : generatePhone(cityInfo.areaCode, false, seed)
  const mobile = (seed * 7) % 5 === 0 ? null : generatePhone(cityInfo.areaCode, true, seed * 3)

  return {
    companyId,
    taxId,
    name,
    type,
    address: buildAddress(seed),
    neighborhood,
    city: cityInfo.city,
    zipCode: buildCep(cityInfo.cepPrefix, seed),
    phone,
    mobile,
    contactName,
    isActive,
  } satisfies Partial<Supplier>
}

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[seed % arr.length]
}

function buildPersonName(seed: number): string {
  const first = pick(FIRST_NAMES, seed)
  const middle = pick(LAST_NAMES, seed * 3 + 1)
  const last = pick(LAST_NAMES, seed * 7 + 5)
  return `${pick(NAME_PREFIXES_PF, seed)}${first} ${middle} ${last}`.trim()
}

function buildCompanyName(seed: number): string {
  const prefix = pick(COMPANY_PREFIXES, seed)
  const theme = pick(COMPANY_THEMES, seed * 3 + 1)
  const suffix = pick(COMPANY_SUFFIXES, seed * 5 + 2)
  return `${prefix} ${theme} ${suffix}`
}

function buildAddress(seed: number): string {
  const streets = [
    'Rua das Acácias', 'Avenida Boa Viagem', 'Rua do Imperador', 'Avenida Conde da Boa Vista',
    'Rua da Aurora', 'Avenida Caxangá', 'Rua Padre Carapuceiro', 'Avenida Domingos Ferreira',
    'Rua Setúbal', 'Avenida 17 de Agosto', 'Rua Real da Torre', 'Avenida Beira Rio',
    'Rua do Bom Jesus', 'Rua Riachuelo', 'Rua Joaquim Nabuco', 'Avenida Agamenon Magalhães',
  ]
  const number = ((seed * 37) % 2500) + 10
  return `${pick(streets, seed)}, ${number}`
}

function buildCep(prefix5: string, seed: number): string {
  const suffix = String((seed * 137) % 1000).padStart(3, '0')
  return `${prefix5}${suffix}`
}

function generatePhone(areaCode: string, isMobile: boolean, seed: number): string {
  // Mobile: 9XXXX-XXXX (9 dígitos após DDD = 11 total)
  // Fixo:  3XXX-XXXX (8 dígitos após DDD = 10 total)
  if (isMobile) {
    const body = String(80000000 + ((seed * 31337) % 19999999))
    return `${areaCode}9${body.padStart(8, '0').slice(0, 8)}`
  }
  const body = String(30000000 + ((seed * 9173) % 9999999))
  return `${areaCode}${body.padStart(8, '0').slice(0, 8)}`
}

// ---------------------------------------------------------------------------
// CPF / CNPJ válidos (com checksum)
// ---------------------------------------------------------------------------

function calcCpfDigit(digits: number[], start: number): number {
  const sum = digits.reduce((acc, n, i) => acc + n * (start - i), 0)
  const rest = (sum * 10) % 11
  return rest === 10 ? 0 : rest
}

function generateCpf(seed: number): string {
  // 9 dígitos base derivados do seed
  const base: number[] = []
  let value = seed * 13 + 1234567
  for (let i = 0; i < 9; i++) {
    base.push(value % 10)
    value = Math.floor(value / 10) + (i + 7) * 31
  }
  // Evita all-same (que falha na validação)
  if (base.every((d) => d === base[0])) base[0] = (base[0] + 1) % 10

  const d1 = calcCpfDigit(base, 10)
  const d2 = calcCpfDigit([...base, d1], 11)
  return [...base, d1, d2].join('')
}

const CNPJ_WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
const CNPJ_WEIGHTS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

function calcCnpjDigit(digits: number[], weights: number[]): number {
  const sum = digits.reduce((acc, n, i) => acc + n * weights[i], 0)
  const rest = sum % 11
  return rest < 2 ? 0 : 11 - rest
}

function generateCnpj(seed: number): string {
  // 12 dígitos base. Últimos 4 antes dos verificadores são tipicamente 0001 (matriz).
  const root: number[] = []
  let value = seed * 17 + 7654321
  for (let i = 0; i < 8; i++) {
    root.push(value % 10)
    value = Math.floor(value / 10) + (i + 3) * 41
  }
  if (root.every((d) => d === root[0])) root[0] = (root[0] + 1) % 10

  const base = [...root, 0, 0, 0, 1]
  const d1 = calcCnpjDigit(base, CNPJ_WEIGHTS_1)
  const d2 = calcCnpjDigit([...base, d1], CNPJ_WEIGHTS_2)
  return [...base, d1, d2].join('')
}
