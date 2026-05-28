import { DateTime } from 'luxon'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Company from '#models/company'
import Customer from '#models/customer'

/**
 * Generates fake customer test data for the demo company, scoped to
 * Pernambuco (PE). Always inserts 150 records — does NOT clear what's already
 * there. Run only in dev/test environments.
 *
 * Distribution:
 *  - ~55% PF (CPF, 11 dígitos) / ~45% PJ (CNPJ, 14 dígitos)
 *  - ~93% ativos / ~7% inativos
 *  - 0% interno (flag `is_internal`) — reservado para configuração manual
 *  - Cidades, bairros, CEPs e DDDs reais de PE
 *  - `customer_since`: distribuído ao longo dos últimos ~8 anos
 *  - `nome fantasia` só nos PJ; PF deixa o campo nulo
 *  - `email` em ~80% dos PJ e ~65% dos PF (derivado do nome)
 */
export default class CustomersSeeder extends BaseSeeder {
  /** Skip the production run. Only runs in dev/test. */
  static environment = ['development', 'testing']

  async run() {
    const company = await Company.query().where('slug', 'empresa-demo').first()
    if (!company) {
      console.log('[customers_seeder] empresa demo não encontrada; rode main_seeder primeiro.')
      return
    }

    // Offset by current row count to keep CPFs/CNPJs deterministic but distinct
    // across re-runs.
    const existing = await Customer.query().where('company_id', company.id).count('* as total')
    const offset = Number(existing[0].$extras.total ?? 0)

    const records = Array.from({ length: 150 }, (_, i) => buildCustomer(company.id, i + offset))
    await Customer.createMany(records)

    console.log(
      `[customers_seeder] 150 clientes PE cadastrados na empresa "${company.slug}" (já tinha ${offset}).`
    )
  }
}

// ---------------------------------------------------------------------------
// Geração de dados
// ---------------------------------------------------------------------------

/** Cidades PE + DDD + faixa de CEP (prefixo de 5 dígitos) usada na cidade. */
const PE_CITIES: Array<{
  city: string
  areaCode: '81' | '87'
  cepPrefix: string
  neighborhoods: string[]
}> = [
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
  { city: 'Gravatá', areaCode: '81', cepPrefix: '55640', neighborhoods: ['Centro', 'Prado', 'Cohab'] },
  { city: 'São Lourenço da Mata', areaCode: '81', cepPrefix: '54700', neighborhoods: ['Centro', 'Tiúma', 'Várzea do Capibaribe'] },
  { city: 'Carpina', areaCode: '81', cepPrefix: '55810', neighborhoods: ['Centro', 'Cohab', 'Cidade Alta'] },
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
  'Cavalcanti', 'Cavalcante', 'Bezerra', 'Maranhão', 'Andrade', 'Brito', 'Correia', 'Lins', 'Tavares', 'Wanderley',
]

const COMPANY_PREFIXES = [
  'Comercial', 'Distribuidora', 'Atacadão', 'Mercantil', 'Indústria', 'Importadora',
  'Loja', 'Casa', 'Empório', 'Grupo', 'Auto Center', 'Centro Automotivo',
]

const COMPANY_THEMES = [
  'Nordeste', 'do Frevo', 'Pernambucana', 'Capibaribe', 'Boa Vista', 'Sertão',
  'Litoral', 'Recife', 'Olinda', 'Caruaru', 'Petrolina', 'Garanhuns', 'do Agreste',
  'Tropical', 'Atlântica', 'da Mata', 'Real', 'Aliança', 'Líder', 'Global',
]

const COMPANY_SUFFIXES = ['Ltda', 'ME', 'EIRELI', 'S/A', 'EPP']

const STREETS = [
  'Rua das Acácias', 'Avenida Boa Viagem', 'Rua do Imperador', 'Avenida Conde da Boa Vista',
  'Rua da Aurora', 'Avenida Caxangá', 'Rua Padre Carapuceiro', 'Avenida Domingos Ferreira',
  'Rua Setúbal', 'Avenida 17 de Agosto', 'Rua Real da Torre', 'Avenida Beira Rio',
  'Rua do Bom Jesus', 'Rua Riachuelo', 'Rua Joaquim Nabuco', 'Avenida Agamenon Magalhães',
  'Rua das Pernambucanas', 'Avenida Mascarenhas de Morais', 'Estrada do Encanamento',
  'Rua Barão de Souza Leão', 'Rua Vinte e Um de Abril', 'Travessa Maria Auxiliadora',
]

const COMPLEMENTS = ['Sala 101', 'Sala 202', 'Loja A', 'Loja B', 'Galpão', 'Andar Térreo', 'Bloco 2', 'Quadra 5', 'Apto 301', 'Apto 405', 'Fundos']

const EMAIL_DOMAINS = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.br', 'uol.com.br']

function buildCustomer(companyId: number, index: number) {
  const seed = index + 1
  const isPj = (seed * 3 + 1) % 9 < 4 // ~44% PJ
  const isActive = (seed * 11) % 100 < 93 // ~93% active

  const cityInfo = pick(PE_CITIES, seed * 5)
  const neighborhood = pick(cityInfo.neighborhoods, seed * 3 + 2)

  const taxId = isPj ? generateCnpj(seed) : generateCpf(seed)
  const legalName = isPj ? buildLegalNamePj(seed) : buildPersonName(seed)
  const tradeName = isPj ? buildTradeName(seed) : null
  const contactName = isPj ? buildPersonName(seed * 17 + 11) : null
  const displayForEmail = tradeName ?? legalName

  const phone = (seed * 5) % 4 === 0 ? null : generatePhone(cityInfo.areaCode, false, seed)
  const mobile = (seed * 7) % 6 === 0 ? null : generatePhone(cityInfo.areaCode, true, seed * 3 + 1)
  const wantsEmail = isPj ? (seed * 13) % 100 < 80 : (seed * 13) % 100 < 65
  const email = wantsEmail ? buildEmail(displayForEmail, seed) : null

  const hasComplement = (seed * 19) % 10 < 3
  const customerSince = buildCustomerSince(seed)

  return {
    companyId,
    type: (isPj ? 'company' : 'individual') as 'company' | 'individual',
    legalName,
    tradeName,
    taxId,
    address: buildAddress(seed),
    addressNumber: buildAddressNumber(seed),
    addressComplement: hasComplement ? pick(COMPLEMENTS, seed * 23 + 5) : null,
    neighborhood,
    city: cityInfo.city,
    zipCode: buildCep(cityInfo.cepPrefix, seed),
    phone,
    mobile,
    email,
    customerSince,
    contactName,
    isActive,
    isInternal: false,
  } satisfies Partial<Customer>
}

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[seed % arr.length]
}

function buildPersonName(seed: number): string {
  const first = pick(FIRST_NAMES, seed)
  const middle = pick(LAST_NAMES, seed * 3 + 1)
  const last = pick(LAST_NAMES, seed * 7 + 5)
  return `${first} ${middle} ${last}`
}

function buildLegalNamePj(seed: number): string {
  const prefix = pick(COMPANY_PREFIXES, seed)
  const theme = pick(COMPANY_THEMES, seed * 3 + 1)
  const suffix = pick(COMPANY_SUFFIXES, seed * 5 + 2)
  return `${prefix} ${theme} ${suffix}`
}

function buildTradeName(seed: number): string {
  const prefix = pick(COMPANY_PREFIXES, seed)
  const theme = pick(COMPANY_THEMES, seed * 3 + 1)
  return `${prefix} ${theme}`
}

function buildAddress(seed: number): string {
  return pick(STREETS, seed)
}

function buildAddressNumber(seed: number): string {
  // ~5% S/N, restante 10–4999
  if ((seed * 29) % 20 === 0) return 'S/N'
  return String(((seed * 37) % 4990) + 10)
}

function buildCep(prefix5: string, seed: number): string {
  const suffix = String((seed * 137) % 1000).padStart(3, '0')
  return `${prefix5}${suffix}`
}

function generatePhone(areaCode: string, isMobile: boolean, seed: number): string {
  if (isMobile) {
    const body = String(80000000 + ((seed * 31337) % 19999999))
    return `${areaCode}9${body.padStart(8, '0').slice(0, 8)}`
  }
  const body = String(30000000 + ((seed * 9173) % 9999999))
  return `${areaCode}${body.padStart(8, '0').slice(0, 8)}`
}

/** Normaliza nome → slug usável em local-part de e-mail. */
function slugifyEmail(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.+/g, '.')
}

function buildEmail(name: string, seed: number): string {
  const local = slugifyEmail(name).slice(0, 40) || 'cliente'
  const suffix = String((seed * 53) % 100).padStart(2, '0')
  return `${local}${suffix}@${pick(EMAIL_DOMAINS, seed * 11 + 3)}`
}

/** Distribui customer_since entre ~2 meses e ~8 anos atrás. */
function buildCustomerSince(seed: number): DateTime {
  const daysBack = 60 + ((seed * 211) % (8 * 365 - 60))
  return DateTime.now().minus({ days: daysBack }).startOf('day')
}

// ---------------------------------------------------------------------------
// CPF / CNPJ válidos (com checksum) — mesmo algoritmo de suppliers_seeder
// ---------------------------------------------------------------------------

function calcCpfDigit(digits: number[], start: number): number {
  const sum = digits.reduce((acc, n, i) => acc + n * (start - i), 0)
  const rest = (sum * 10) % 11
  return rest === 10 ? 0 : rest
}

function generateCpf(seed: number): string {
  const base: number[] = []
  let value = seed * 13 + 9876543
  for (let i = 0; i < 9; i++) {
    base.push(value % 10)
    value = Math.floor(value / 10) + (i + 11) * 37
  }
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
  const root: number[] = []
  let value = seed * 19 + 1357913
  for (let i = 0; i < 8; i++) {
    root.push(value % 10)
    value = Math.floor(value / 10) + (i + 5) * 43
  }
  if (root.every((d) => d === root[0])) root[0] = (root[0] + 1) % 10

  const base = [...root, 0, 0, 0, 1]
  const d1 = calcCnpjDigit(base, CNPJ_WEIGHTS_1)
  const d2 = calcCnpjDigit([...base, d1], CNPJ_WEIGHTS_2)
  return [...base, d1, d2].join('')
}
