// tb_user 한 줄을 앱에서 쓰기 쉬운 형태로 가져오는 모듈
// Auth(로그인)와 화면은 이 파일만 보면 된다 — SQL을 화면에 흩뿌리지 않기 위함
import { supabase } from './supabaseClient'

// 화면·푸시등록에서 쓰는 프로필 (컬럼명 → 카멜케이스)
export type UserProfile = {
    userUuid: string // auth.users.id 와 같음 (tb_user.user_uuid)
    userSrno: string // 고객번호 W0001 ...
    userId: string // 로그인 아이디 (이메일 형태)
    nickname: string
    useYn: string // Y/N
}

// DB 한 행 → UserProfile. 컬럼이 비어 있으면 빈 문자열
function mapRowToProfile(row: {
    user_uuid: string
    user_srno: string
    user_id: string
    nickname: string | null
    use_yn: string
}): UserProfile {
    return {
        userUuid: row.user_uuid,
        userSrno: row.user_srno,
        userId: row.user_id,
        nickname: row.nickname ?? '',
        useYn: row.use_yn,
    }
}

/**
 * auth uuid 로 tb_user 조회
 * - 로그인 직후, 앱 재실행(자동로그인) 때 호출
 * - 없으면 null (Auth만 있고 프로필 insert 실패한 경우)
 */
export async function fetchUserProfileByUuid(userUuid: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
        .from('tb_user') // 회원 테이블
        .select('user_uuid, user_srno, user_id, nickname, use_yn') // 화면에 필요한 컬럼만
        .eq('user_uuid', userUuid) // Auth id = 프로필 키
        .maybeSingle() // 0건이면 data null (에러 아님)

    if (error) {
        console.info('tb_user 조회 실패:', error.message)
        return null
    }
    if (!data) return null
    return mapRowToProfile(data)
}
