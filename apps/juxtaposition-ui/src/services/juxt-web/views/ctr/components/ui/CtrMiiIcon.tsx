import { useUrl } from '@/services/juxt-web/views/common/hooks/useUrl';
import { CtrIcon } from '@/services/juxt-web/views/ctr/components/ui/CtrIcon';
import type { ReactNode } from 'react';
import type { MiiIconProps } from '@/services/juxt-web/views/web/components/ui/WebMiiIcon';

export function CtrMiiIcon(props: MiiIconProps): ReactNode {
	const url = useUrl();
	const miiPath = props.face_url ? new URL(props.face_url).pathname : `/mii/${props.pid}/normal_face.png`;
	const miiUrl = url.cdn(miiPath);
	const href = `/users/${props.pid}`;
	const type = props.type ?? 'mii-icon';

	return (
		<CtrIcon
			href={props.type !== 'header-icon' ? href : undefined}
			src={miiUrl}
			type={type}
			className={props.className}
		>
		</CtrIcon>
	);
}
