import type { Metadata } from 'next';
import Link from 'next/link';
import { Bullets, LegalDoc, Numbered, Section } from '@/app/_components/LegalDoc';
import { formatLegalDate, LEGAL_EFFECTIVE_DATE, OPERATOR, SERVICE_NAME } from '@/lib/legal';

export const metadata: Metadata = { title: '이용약관' };

export default function TermsPage() {
  return (
    <LegalDoc title="이용약관" other={{ href: '/privacy', label: '개인정보 처리방침 →' }}>
      <Section title="제1조 (목적)">
        <p>
          이 약관은 {OPERATOR.name}(이하 &lsquo;운영자&rsquo;)이 개인적으로 운영하는 가족용 영어
          단어 학습 서비스 &lsquo;{SERVICE_NAME}&rsquo;(이하 &lsquo;서비스&rsquo;)의 이용 조건과
          절차, 운영자와 이용자의 권리·의무를 정합니다.
        </p>
      </Section>

      <Section title="제2조 (서비스 내용과 요금)">
        <Bullets>
          <li>
            서비스는 단어 등록, 단어 시험·재시험, 결과 확인, 사진 속 단어 인식, 발음 듣기 기능을
            제공합니다.
          </li>
          <li>서비스는 무료이며, 이용 요금이나 광고가 없습니다.</li>
        </Bullets>
      </Section>

      <Section title="제3조 (계정)">
        <Numbered>
          <li>회원 가입은 법정대리인이 될 수 있는 성인(부모·보호자)만 할 수 있습니다.</li>
          <li>
            부모 회원은 자기 가족 계정과 그 안의 자녀 프로필·자녀 계정의 이용에 책임을 집니다. 자녀
            프로필은 본인이 법정대리인인 자녀에 대해서만 등록해야 합니다.
          </li>
          <li>
            비밀번호, 자녀 아이디·비밀번호, 부모 PIN은 안전하게 관리해야 하며, 다른 사람에게 알려
            생긴 문제는 해당 회원이 책임집니다. 도용이 의심되면 곧바로 비밀번호를 바꾸고 운영자에게
            알려 주세요.
          </li>
        </Numbered>
      </Section>

      <Section title="제4조 (이용자 콘텐츠)">
        <Numbered>
          <li>이용자가 등록한 단어·뜻 등 콘텐츠의 정확성과 적법성은 이용자에게 책임이 있습니다.</li>
          <li>
            교재 사진 등을 단어 인식에 쓸 때는 개인 학습 목적으로만 이용해야 하며, 저작권자의 권리를
            침해해서는 안 됩니다. 서비스는 사진을 저장하지 않습니다.
          </li>
          <li>
            이용자 콘텐츠의 권리는 이용자에게 있으며, 운영자는 서비스 제공에 필요한 범위에서만 이를
            처리합니다.
          </li>
        </Numbered>
      </Section>

      <Section title="제5조 (금지 행위)">
        <p>이용자는 다음 행위를 해서는 안 됩니다.</p>
        <Bullets>
          <li>다른 사람의 정보를 도용하거나 다른 가족의 데이터에 접근하려는 행위</li>
          <li>자동화 도구 등으로 과도한 요청을 보내 서비스에 부담을 주는 행위</li>
          <li>서비스를 공격하거나 보안·이용 제한을 우회하려는 행위</li>
          <li>법령이나 공공질서에 어긋나는 내용을 등록하는 행위</li>
        </Bullets>
        <p>위반 시 운영자는 서비스 이용을 제한하거나 계정을 삭제할 수 있습니다.</p>
      </Section>

      <Section title="제6조 (AI 기능의 한계)">
        <p>
          사진 속 단어 인식과 발음 합성은 외부 AI 서비스를 이용하므로 결과가 틀리거나 빠질 수
          있습니다. 이용자는 인식된 단어와 뜻을 등록 전에 직접 확인해야 합니다.
        </p>
      </Section>

      <Section title="제7조 (서비스 변경·중단)">
        <Numbered>
          <li>
            운영자는 서비스의 내용을 바꾸거나 서비스를 종료할 수 있으며, 가능한 한 미리 앱 안에서
            알립니다. 장애·점검 등 불가피한 경우에는 사후에 알릴 수 있습니다.
          </li>
          <li>서비스를 종료하면 보관 중인 이용자 데이터는 모두 삭제합니다.</li>
        </Numbered>
      </Section>

      <Section title="제8조 (책임의 제한)">
        <p>
          서비스는 무료로 제공되므로, 운영자는 서비스 이용이나 이용 불가로 생긴 손해에 대해 책임을
          지지 않습니다. 다만 운영자의 고의 또는 중대한 과실로 생긴 손해는 예외로 합니다.
        </p>
      </Section>

      <Section title="제9조 (회원 탈퇴)">
        <p>
          회원은 언제든지 <strong>설정 → 회원 탈퇴</strong>로 탈퇴할 수 있습니다. 탈퇴 시 데이터
          처리는{' '}
          <Link href="/privacy" className="text-brand-600 hover:underline">
            개인정보 처리방침
          </Link>
          에 따릅니다.
        </p>
      </Section>

      <Section title="제10조 (약관 변경과 준거법)">
        <Numbered>
          <li>
            운영자는 필요한 경우 약관을 바꿀 수 있으며, 바뀐 약관은 시행 전에 앱 안에서 알립니다.
          </li>
          <li>
            이 약관은 대한민국 법률에 따르며, 분쟁은 관련 법령에 따른 관할 법원에서 해결합니다.
          </li>
          <li>
            문의:{' '}
            <a href={`mailto:${OPERATOR.email}`} className="text-brand-600 hover:underline">
              {OPERATOR.email}
            </a>
          </li>
        </Numbered>
      </Section>

      <Section title="부칙">
        <p>이 약관은 {formatLegalDate(LEGAL_EFFECTIVE_DATE)}부터 시행합니다.</p>
      </Section>
    </LegalDoc>
  );
}
