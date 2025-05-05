import { useParams } from "react-router-dom";
import { usePageQuery } from "@/features/page/queries/page-query";
import { FullEditor } from "@/features/editor/full-editor";
import HistoryModal from "@/features/page-history/components/history-modal";
import { Helmet } from "react-helmet-async";
import PageHeader from "@/features/page/components/header/page-header.tsx";
import { extractPageSlugId } from "@/lib";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";
import { useTranslation } from "react-i18next";
import { pageEvents } from "@/lib/analytics";
import { useEffect } from "react";

export default function Page() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const pageId = extractPageSlugId(pageSlug);
  const {
    data: page,
    isLoading,
    isError,
    error,
  } = usePageQuery({ pageId });
  const { data: space } = useGetSpaceBySlugQuery(page?.space?.slug);

  const spaceRules = space?.membership?.permissions;
  const spaceAbility = useSpaceAbility(spaceRules);

  // Track page view and errors with PostHog
  useEffect(() => {
    if (page) {
      // Track detailed page view when page data is loaded
      pageEvents.viewed({
        page_id: page.id,
        page_title: page.title || 'Untitled',
        page_slug: pageSlug,
        space_slug: page.space?.slug,
        space_id: page.space?.id,
        is_readonly: spaceAbility.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page),
      });
    } else if (isError && !isLoading) {
      // Track page load errors
      pageEvents.error({
        page_slug: pageSlug,
        error_type: error?.["status"] ? `HTTP ${error["status"]}` : 'Unknown error',
        error_message: error?.message || 'Error fetching page data',
      });
    }
  }, [page, isError, isLoading, error, pageSlug, spaceAbility]);

  if (isLoading) {
    return <></>;
  }

  if (isError || !page) {
    if ([401, 403, 404].includes(error?.["status"])) {
      return <div>{t("Page not found")}</div>;
    }
    return <div>{t("Error fetching page data.")}</div>;
  }

  if (!space) {
    return <></>;
  }

  return (
    page && (
      <div>
        <Helmet>
          <title>{`${page?.icon || ""}  ${page?.title || t("untitled")}`}</title>
        </Helmet>

        <PageHeader
          readOnly={spaceAbility.cannot(
            SpaceCaslAction.Manage,
            SpaceCaslSubject.Page,
          )}
        />

        <FullEditor
          key={page.id}
          pageId={page.id}
          title={page.title}
          content={page.content}
          slugId={page.slugId}
          spaceSlug={page?.space?.slug}
          editable={spaceAbility.can(
            SpaceCaslAction.Manage,
            SpaceCaslSubject.Page,
          )}
        />
        <HistoryModal pageId={page.id} />
      </div>
    )
  );
}
