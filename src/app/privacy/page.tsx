import type { Metadata } from 'next';
import Link from 'next/link';
import { Bullets, LegalDoc, Section } from '@/app/_components/LegalDoc';
import {
  formatLegalDate,
  LEGAL_EFFECTIVE_DATE,
  OPERATOR,
  SERVICE_NAME,
  SUPABASE_REGION,
} from '@/lib/legal';

export const metadata: Metadata = { title: '개인정보 처리방침' };

const TRANSFERS = [
  {
    to: 'Vercel Inc.',
    country: '미국 (앱 서버는 호주 시드니 리전에서 실행)',
    items: '서비스 이용 중 주고받는 모든 정보 (계정·학습 정보, 단어 사진 등), 익명 방문 통계',
    purpose: '웹 서비스 호스팅 및 요청 처리, 방문 통계(Web Analytics)',
  },
  {
    to: 'Supabase Inc.',
    country: `미국 (데이터베이스 위치: ${SUPABASE_REGION})`,
    items: '계정 정보, 자녀 프로필, 학습 정보',
    purpose: '회원 인증 및 데이터 저장',
  },
  {
    to: 'Google LLC (Gemini API)',
    country: '미국',
    items: '단어 인식을 위해 올린 사진',
    purpose:
      '사진 속 단어 인식 (voca는 사진을 저장하지 않으며, 유료 등급으로 이용해 모델 학습에 쓰이지 않음)',
  },
  {
    to: 'Cloudflare, Inc. (Turnstile)',
    country: '미국',
    items: '가입·로그인 시 브라우저·접속 정보 (자동화 여부 판별용)',
    purpose: '자동화된 가입·로그인 공격 방지',
  },
  {
    to: 'Google LLC (Cloud Text-to-Speech)',
    country: '미국',
    items: '영어 단어 텍스트 (개인 식별 정보 없음)',
    purpose: '단어 발음 음성 합성',
  },
];

const th =
  'whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold';
const td = 'border-b border-slate-100 px-3 py-2 align-top';

export default function PrivacyPage() {
  return (
    <LegalDoc title="개인정보 처리방침" other={{ href: '/terms', label: '이용약관 →' }}>
      <p>
        {OPERATOR.name}(이하 &lsquo;운영자&rsquo;)은 가족용 영어 단어 학습 서비스 &lsquo;
        {SERVICE_NAME}&rsquo;(이하 &lsquo;서비스&rsquo;)를 개인이 비영리·무료로 운영하며, 「개인정보
        보호법」에 따라 이용자의 개인정보를 보호하고 관련 고충을 신속하게 처리하기 위해 다음과 같이
        개인정보 처리방침을 둡니다.
      </p>

      <Section title="1. 처리하는 개인정보 항목">
        <Bullets>
          <li>
            <strong>부모(보호자) 회원</strong>: 이메일 주소, 비밀번호(Supabase Auth가 단방향
            암호화하여 보관), 호칭(표시 이름)
          </li>
          <li>
            <strong>자녀 프로필</strong>(부모가 입력): 이름 또는 별명, 아바타 이모지. 선택적으로
            자녀 전용 로그인 아이디와 비밀번호(암호화 보관). 자녀 아이디는 실제 이메일이 아닌 내부용
            가상 주소(<code>아이디@kids.voca.invalid</code>) 형태로 저장되며, 자녀의 실제 이메일은
            받지 않습니다.
          </li>
          <li>
            <strong>학습 정보</strong>: 등록한 단어와 뜻, 시험 답안과 채점 결과, 각 기록의 생성·응시
            시각
          </li>
          <li>
            <strong>자동 수집 정보</strong>: 로그인 유지를 위한 세션 쿠키. 접속 기록(IP 주소, 요청 시각
            등 서버 로그)은 호스팅 사업자가 보관합니다. 서비스 개선을 위해 Vercel Web Analytics로 쿠키 없이
            익명화된 방문 통계(방문 페이지, 기기·브라우저 종류, 국가)를 수집하며, 개인을 식별하지 않습니다.
            광고용 추적 도구는 사용하지 않습니다. 가입·로그인 시 자동화된 공격을 막기 위해 Cloudflare
            Turnstile이 브라우저 정보를 일시 확인할 수 있습니다.
          </li>
          <li>
            <strong>단어 인식용 사진</strong>: 교재 사진 등에서 단어를 뽑아낼 때 사진을 AI 서비스로
            보내 한 번 처리하며, 서비스는 사진을 저장하지 않습니다.
          </li>
        </Bullets>
      </Section>

      <Section title="2. 처리 목적">
        <Bullets>
          <li>회원 가입·로그인, 가족 및 자녀 프로필 관리</li>
          <li>단어 등록, 시험 출제·채점, 결과 및 학습 기록 제공</li>
          <li>부정 이용 방지와 서비스 안정성 확보</li>
        </Bullets>
        <p>위 목적 외의 용도로는 이용하지 않으며, 목적이 바뀌면 미리 동의를 받습니다.</p>
      </Section>

      <Section title="3. 보유 및 이용 기간">
        <Bullets>
          <li>개인정보는 회원 탈퇴 시까지 보유·이용합니다.</li>
          <li>회원 탈퇴 시 해당 회원의 정보는 지체 없이 삭제합니다.</li>
          <li>
            가족의 마지막 부모 회원이 탈퇴하면 자녀 프로필·자녀 계정·단어·시험 기록을 포함한 가족
            전체 데이터가 함께 삭제됩니다.
          </li>
          <li>
            호스팅 사업자의 백업에는 삭제된 정보가 일정 기간 남아 있을 수 있으며, 해당 기간이 지나면
            자동으로 삭제됩니다.
          </li>
        </Bullets>
      </Section>

      <Section title="4. 개인정보 처리 위탁 및 국외 이전">
        <p>
          서비스 운영을 위해 아래 사업자에게 개인정보 처리를 위탁하며, 이 과정에서 개인정보가 국외로
          이전됩니다. 이전은 서비스 이용 시점마다 암호화된 네트워크 전송(HTTPS)으로 이루어지고, 보유
          기간은 회원 탈퇴 또는 위탁 계약 종료 시까지입니다(단어 인식용 사진은 처리 즉시 폐기,
          발음용 단어 텍스트는 음성 합성 처리 후 폐기).
        </p>
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <caption className="sr-only">개인정보 처리 위탁 및 국외 이전 현황</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>
                  이전받는 자
                </th>
                <th scope="col" className={th}>
                  이전 국가
                </th>
                <th scope="col" className={th}>
                  이전 항목
                </th>
                <th scope="col" className={th}>
                  이용 목적
                </th>
                <th scope="col" className={th}>
                  보유 기간
                </th>
                <th scope="col" className={th}>
                  이전 방법
                </th>
              </tr>
            </thead>
            <tbody>
              {TRANSFERS.map((t) => (
                <tr key={t.to}>
                  <th scope="row" className={`${td} text-left font-medium whitespace-nowrap`}>
                    {t.to}
                  </th>
                  <td className={td}>{t.country}</td>
                  <td className={td}>{t.items}</td>
                  <td className={td}>{t.purpose}</td>
                  <td className={td}>
                    회원 탈퇴 또는 위탁 종료 시까지 (일회성 처리 항목은 처리 후 즉시)
                  </td>
                  <td className={td}>서비스 이용 시 네트워크 전송</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-slate-500">
          국외 이전을 원하지 않으면 동의를 거부할 수 있으나, 위 사업자 없이는 서비스를 제공할 수
          없어 가입이 제한됩니다. 이미 가입했다면 회원 탈퇴로 이전을 중단할 수 있습니다.
        </p>
      </Section>

      <Section title="5. 만 14세 미만 아동의 개인정보">
        <Bullets>
          <li>
            자녀 프로필은 법정대리인인 부모 회원만 만들 수 있으며, 자녀가 혼자 가입할 수는 없습니다.
          </li>
          <li>
            부모 회원은 자녀 프로필을 등록할 때 자녀 개인정보 처리에 대해 법정대리인으로서
            동의합니다.
          </li>
          <li>
            부모 회원은 언제든지 자녀의 정보를 열람·수정·삭제하거나 처리 정지를 요구할 수 있습니다.
          </li>
        </Bullets>
      </Section>

      <Section title="6. 이용자와 법정대리인의 권리와 행사 방법">
        <Bullets>
          <li>
            이용자는 언제든지 개인정보 열람, 정정, 삭제, 처리 정지를 요구할 수 있습니다. 앱의 설정
            화면에서 직접 하거나 아래 개인정보 보호책임자 이메일로 요청하면 지체 없이 처리합니다.
          </li>
          <li>
            회원 탈퇴: <strong>설정 → (부모 모드) 회원 탈퇴</strong>, 자녀 정보 삭제: <strong>설정 → 자녀별 설정 → 프로필 삭제</strong>
          </li>
          <li>부모 회원은 자녀 프로필과 자녀의 학습 정보를 변경하거나 삭제할 수 있습니다.</li>
        </Bullets>
      </Section>

      <Section title="7. 개인정보의 파기 절차 및 방법">
        <p>
          보유 기간이 끝나거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다. 전자적 파일
          형태의 정보는 복구할 수 없는 방법으로 영구 삭제하며, 종이 문서로는 개인정보를 보관하지
          않습니다.
        </p>
      </Section>

      <Section title="8. 개인정보의 안전성 확보 조치">
        <Bullets>
          <li>전송 구간 암호화(HTTPS)</li>
          <li>비밀번호 단방향 암호화(해시) 저장</li>
          <li>
            접근 통제: 브라우저에서 데이터베이스에 직접 접근할 수 없고, 모든 데이터 조회는 서버에서
            가족 단위로 분리하여 처리
          </li>
          <li>관리 기능(단어 관리, 설정 등)은 부모 PIN으로 한 번 더 보호</li>
          <li>개인정보 접근 권한을 운영자 1인으로 최소화</li>
        </Bullets>
      </Section>

      <Section title="9. 쿠키의 설치·운영 및 거부">
        <p>
          서비스는 로그인과 기능 유지에 꼭 필요한 쿠키만 사용하며, 광고·분석 쿠키는 쓰지 않습니다(방문 통계는 쿠키 없이 수집).
        </p>
        <Bullets>
          <li>Supabase 인증 세션 쿠키: 로그인 상태 유지</li>
          <li>
            <code>voca_learner</code>: 선택한 자녀 프로필 기억
          </li>
          <li>
            <code>voca_parent</code>: 부모 모드 확인용 토큰
          </li>
        </Bullets>
        <p>
          브라우저 설정에서 쿠키를 거부할 수 있지만, 이 경우 로그인을 할 수 없어 서비스를 이용할 수
          없습니다.
        </p>
      </Section>

      <Section title="10. 개인정보 보호책임자">
        <Bullets>
          <li>성명: {OPERATOR.name} (운영자)</li>
          <li>
            이메일:{' '}
            <a href={`mailto:${OPERATOR.email}`} className="text-brand-600 hover:underline">
              {OPERATOR.email}
            </a>
          </li>
        </Bullets>
        <p>
          개인정보 관련 문의, 불만, 피해 구제 요청은 위 이메일로 보내 주시면 지체 없이
          답변·처리합니다.
        </p>
      </Section>

      <Section title="11. 권익침해 구제 방법">
        <p>개인정보 침해에 대한 신고나 상담이 필요하면 아래 기관에 문의할 수 있습니다.</p>
        <Bullets>
          <li>
            개인정보침해신고센터:{' '}
            <a
              href="https://privacy.kisa.or.kr"
              className="text-brand-600 hover:underline"
              rel="noopener noreferrer"
            >
              privacy.kisa.or.kr
            </a>{' '}
            / 국번 없이 118
          </li>
          <li>
            개인정보분쟁조정위원회:{' '}
            <a
              href="https://www.kopico.go.kr"
              className="text-brand-600 hover:underline"
              rel="noopener noreferrer"
            >
              kopico.go.kr
            </a>{' '}
            / 1833-6972
          </li>
        </Bullets>
      </Section>

      <Section title="12. 처리방침의 변경">
        <p>
          이 개인정보 처리방침은 {formatLegalDate(LEGAL_EFFECTIVE_DATE)}부터 시행합니다. 내용이 바뀌면 시행
          전에 앱 안에서 알립니다. 서비스 이용 조건은{' '}
          <Link href="/terms" className="text-brand-600 hover:underline">
            이용약관
          </Link>
          을 참고하세요.
        </p>
      </Section>
    </LegalDoc>
  );
}
