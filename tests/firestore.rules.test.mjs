import { after, before, beforeEach, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const projectId = 'pcm-talent-ai-rules-test';
let testEnv;

const profiles = {
  admin: {
    uid: 'admin-uid',
    nome: 'Admin Teste',
    email: 'admin@example.test',
    role: 'Administrador Master',
    status: 'Ativo',
    createdAt: '2026-09-08T00:00:00.000Z',
  },
  gestor: {
    uid: 'gestor-uid',
    nome: 'Gestor Teste',
    email: 'gestor@example.test',
    role: 'Gestor',
    status: 'Ativo',
    createdAt: '2026-09-08T00:00:00.000Z',
  },
  rh: {
    uid: 'rh-uid',
    nome: 'RH Teste',
    email: 'rh@example.test',
    role: 'RH',
    status: 'Ativo',
    createdAt: '2026-09-08T00:00:00.000Z',
  },
  diretoria: {
    uid: 'diretoria-uid',
    nome: 'Diretoria Teste',
    email: 'diretoria@example.test',
    role: 'Diretoria',
    status: 'Ativo',
    createdAt: '2026-09-08T00:00:00.000Z',
  },
  observador: {
    uid: 'observador-uid',
    nome: 'Observador Teste',
    email: 'observador@example.test',
    role: 'Observador',
    status: 'Ativo',
    createdAt: '2026-09-08T00:00:00.000Z',
  },
  legacyMaster: {
    uid: 'legacy-master-uid',
    email: 'legacy-master@example.test',
    role: 'Administrador Master',
    createdAt: '2026-08-14T00:00:00.000Z',
  },
};

const candidate = {
  fase: 'Triagem',
  nome: 'Candidato Fictício',
  email: 'candidato@example.test',
  vagaId: 'vaga-1',
  demografia: 'Cidade fictícia',
  experienciaAnos: 5,
  formacao: 'Formação fictícia',
  certificacoes: 'Certificação fictícia',
  resumoIA: 'Resumo gerado apenas para teste.',
  createdAt: new Date('2026-09-08T00:00:00.000Z'),
  createdBy: profiles.admin.email,
  rhSalario: '',
  rhPretensao: '',
  rhFit: '',
  rhBeneficios: '',
  tecFortes: '',
  tecFracos: '',
  tecPratica: '',
  dirVeredito: '',
  justificativaReprovacao: '',
};

function dbFor(profileName) {
  const profile = profiles[profileName];
  return testEnv
    .authenticatedContext(profile.uid, { email: profile.email })
    .firestore();
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const profile of Object.values(profiles)) {
      await setDoc(doc(db, 'users', profile.uid), profile);
    }
    await setDoc(doc(db, 'vagas', 'vaga-1'), {
      titulo: 'Vaga fictícia',
      area: 'Área de teste',
      salarioMin: '0',
      salarioMax: '0',
      modelo: 'Presencial',
      senioridade: 'Pleno',
      obrigatorios: 'Teste',
      desejaveis: 'Teste',
      status: 'Em Andamento',
      createdAt: new Date('2026-09-08T00:00:00.000Z'),
      gestor: profiles.admin.email,
    });
    await setDoc(doc(db, 'candidatos', 'candidato-1'), candidate);
  });
});

after(async () => {
  await testEnv.cleanup();
});

describe('bloqueio externo e perfis', () => {
  test('nega leitura sem autenticação', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'candidatos', 'candidato-1')));
  });

  test('nega usuário autenticado sem perfil autorizado', async () => {
    const db = testEnv
      .authenticatedContext('intruso-uid', { email: 'intruso@example.test' })
      .firestore();
    await assertFails(getDocs(collection(db, 'vagas')));
    await assertFails(getDocs(collection(db, 'candidatos')));
  });

  test('observador lê vagas, mas não currículos', async () => {
    const db = dbFor('observador');
    await assertSucceeds(getDocs(collection(db, 'vagas')));
    await assertFails(getDocs(collection(db, 'candidatos')));
  });

  test('mantém acesso do master legado até normalização do perfil', async () => {
    const db = dbFor('legacyMaster');
    await assertSucceeds(getDocs(collection(db, 'vagas')));
    await assertSucceeds(getDocs(collection(db, 'candidatos')));
  });
});

describe('segregação de funções', () => {
  test('administrador lê dados e atualiza usuário não master', async () => {
    const db = dbFor('admin');
    await assertSucceeds(getDocs(collection(db, 'candidatos')));
    await assertSucceeds(getDocs(collection(db, 'users')));
    await assertSucceeds(updateDoc(doc(db, 'users', profiles.gestor.uid), { status: 'Inativo' }));
    await assertFails(updateDoc(doc(db, 'users', profiles.admin.uid), { status: 'Inativo' }));
  });

  test('gestor altera avaliação técnica, mas não avaliação de RH', async () => {
    const db = dbFor('gestor');
    await assertSucceeds(updateDoc(doc(db, 'candidatos', 'candidato-1'), { tecFortes: 'Teste técnico' }));
    await assertFails(updateDoc(doc(db, 'candidatos', 'candidato-1'), { rhFit: 'Alteração indevida' }));
    await assertFails(getDocs(collection(db, 'users')));
  });

  test('RH altera avaliação de RH, mas não veredito da diretoria', async () => {
    const db = dbFor('rh');
    await assertSucceeds(updateDoc(doc(db, 'candidatos', 'candidato-1'), { rhFit: 'Parecer fictício' }));
    await assertFails(updateDoc(doc(db, 'candidatos', 'candidato-1'), { dirVeredito: 'Alteração indevida' }));
  });

  test('diretoria altera apenas seu veredito e a fase', async () => {
    const db = dbFor('diretoria');
    await assertSucceeds(updateDoc(doc(db, 'candidatos', 'candidato-1'), {
      dirVeredito: 'Veredito fictício',
      fase: 'Aprovado',
    }));
    await assertFails(updateDoc(doc(db, 'candidatos', 'candidato-1'), { tecFracos: 'Alteração indevida' }));
  });

  test('somente administrador exclui candidato', async () => {
    await assertFails(deleteDoc(doc(dbFor('rh'), 'candidatos', 'candidato-1')));
    await assertSucceeds(deleteDoc(doc(dbFor('admin'), 'candidatos', 'candidato-1')));
  });
});

describe('integridade de gravações', () => {
  test('RH cria candidato com autoria e timestamp do servidor', async () => {
    const db = dbFor('rh');
    const newCandidate = {
      ...candidate,
      createdAt: serverTimestamp(),
      createdBy: profiles.rh.email,
    };
    await assertSucceeds(addDoc(collection(db, 'candidatos'), newCandidate));
  });

  test('nega candidato com autoria falsificada', async () => {
    const db = dbFor('rh');
    await assertFails(addDoc(collection(db, 'candidatos'), {
      ...candidate,
      createdAt: serverTimestamp(),
      createdBy: 'outra-pessoa@example.test',
    }));
  });

  test('log é somente inclusão e não aceita identidade falsificada', async () => {
    const db = dbFor('gestor');
    const validLog = {
      action: 'TESTE',
      details: 'Registro fictício',
      targetUser: '',
      previousValue: '',
      newValue: '',
      performedBy: profiles.gestor.email,
      userRole: profiles.gestor.role,
      timestamp: serverTimestamp(),
    };
    const created = await assertSucceeds(addDoc(collection(db, 'audit_logs'), validLog));
    await assertFails(updateDoc(doc(db, 'audit_logs', created.id), { details: 'Alterado' }));
    await assertFails(addDoc(collection(db, 'audit_logs'), {
      ...validLog,
      performedBy: profiles.admin.email,
    }));
  });
});
