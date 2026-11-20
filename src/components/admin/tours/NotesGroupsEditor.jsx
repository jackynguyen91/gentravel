import LineListEditor from "@/components/admin/tours/LineListEditor";
import { Section } from "@/components/admin/tours/form-parts";
import { NOTE_GROUPS } from "@/lib/tour-options";

// Lưu ý chia nhóm: Giấy tờ và visa, Hành lý, Trẻ em, Thời tiết và trang phục, Khác.
export default function NotesGroupsEditor({ form, set }) {
  const groups = NOTE_GROUPS.map((group) => {
    const found = (form.notes_groups || []).find((row) => row.group === group);
    return { group, items: found?.items || [] };
  });

  const setGroup = (group, items) => {
    const next = groups.map((row) => (row.group === group ? { ...row, items } : row));
    set("notes_groups", next);
    // Giữ danh sách phẳng để trang khách và SEO cũ vẫn đọc được.
    set("notes", next.flatMap((row) => (row.items || []).filter(Boolean)));
  };

  return (
    <Section title="Lưu ý chia nhóm" hint="Mỗi nhóm một danh sách dòng, kéo thả để đổi thứ tự. Nội dung sẽ hiện theo nhóm trên trang khách.">
      <div className="space-y-3">
        {groups.map((row) => (
          <div key={row.group} className="rounded-lg border border-slate-100 p-2.5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">{row.group}</p>
            <LineListEditor
              items={row.items}
              onChange={(items) => setGroup(row.group, items)}
              placeholder={`Lưu ý về ${row.group.toLowerCase()}`}
              addLabel="Thêm lưu ý"
              emptyHint="Chưa có lưu ý trong nhóm này."
            />
          </div>
        ))}
      </div>
    </Section>
  );
}