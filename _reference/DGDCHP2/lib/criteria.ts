export type CriterionGroupId =
  | 'leadership'
  | 'program_chair'
  | 'department'
  | 'industry'
  | 'qa';

export interface Criterion {
  id: string;
  text: string;
}

export interface CriterionGroup {
  id: CriterionGroupId;
  name: string;
  audience: string;
  goal: string;
  criteria: Criterion[];
}

export const CRITERIA_GROUPS: CriterionGroup[] = [
  {
    id: 'leadership',
    name: 'Ban lãnh đạo khoa/trường',
    audience: 'Ban lãnh đạo khoa/trường',
    goal: 'Đảm bảo học phần phù hợp với chiến lược phát triển và định hướng đào tạo của trường.',
    criteria: [
      { id: 'l1', text: 'Mức độ phù hợp với sứ mạng – tầm nhìn của trường/khoa' },
      { id: 'l2', text: 'Sự liên kết với chuẩn đầu ra chương trình đào tạo (PLO)' },
      { id: 'l3', text: 'Tính cập nhật theo xu hướng nghề nghiệp và công nghệ mới' },
      { id: 'l4', text: 'Khả năng góp phần nâng cao chất lượng và thương hiệu ngành' },
      { id: 'l5', text: 'Tính liên ngành và chuyển đổi số trong học phần' },
      { id: 'l6', text: 'Mức độ tích hợp AI, dữ liệu số, kỹ năng số' },
      { id: 'l7', text: 'Tính quốc tế hóa và khả năng hội nhập' },
      { id: 'l8', text: 'Khả năng triển khai thực tế với nguồn lực hiện có' },
      { id: 'l9', text: 'Hiệu quả sử dụng giảng viên, phòng học, LMS' },
      { id: 'l10', text: 'Khả năng thu hút người học và tạo giá trị cạnh tranh cho chương trình' },
    ],
  },
  {
    id: 'program_chair',
    name: 'Trưởng ngành / Chủ nhiệm chương trình đào tạo',
    audience: 'Trưởng ngành / Chủ nhiệm chương trình đào tạo',
    goal: 'Đảm bảo học phần đồng bộ với cấu trúc toàn chương trình.',
    criteria: [
      { id: 'p1', text: 'CLO rõ ràng, đo lường được' },
      { id: 'p2', text: 'Liên kết CLO–PLO hợp lý' },
      { id: 'p3', text: 'Phân bổ mức độ nhận thức theo Bloom phù hợp' },
      { id: 'p4', text: 'Nội dung không trùng lặp với học phần khác' },
      { id: 'p5', text: 'Logic tiên quyết – học trước – học sau' },
      { id: 'p6', text: 'Khối lượng học tập phù hợp số tín chỉ' },
      { id: 'p7', text: 'Tỷ lệ lý thuyết – thực hành hợp lý' },
      { id: 'p8', text: 'Sự đóng góp của học phần vào năng lực nghề nghiệp' },
      { id: 'p9', text: 'Tính liên thông giữa các học phần trong chương trình' },
      { id: 'p10', text: 'Hệ thống đánh giá sinh viên phù hợp CLO' },
    ],
  },
  {
    id: 'department',
    name: 'Trưởng bộ môn / Hội đồng chuyên môn',
    audience: 'Trưởng bộ môn / Hội đồng chuyên môn',
    goal: 'Đảm bảo chất lượng học thuật và chuyên môn sâu.',
    criteria: [
      { id: 'd1', text: 'Tính chính xác và cập nhật học thuật' },
      { id: 'd2', text: 'Nội dung bám sát tên học phần' },
      { id: 'd3', text: 'Cấu trúc chủ đề logic, khoa học' },
      { id: 'd4', text: 'Mức độ chuyên sâu phù hợp trình độ đào tạo' },
      { id: 'd5', text: 'Giáo trình và tài liệu tham khảo cập nhật' },
      { id: 'd6', text: 'Tính cân đối giữa lý thuyết và tình huống thực tiễn' },
      { id: 'd7', text: 'Phương pháp giảng dạy phù hợp' },
      { id: 'd8', text: 'Đề cao tư duy phản biện và giải quyết vấn đề' },
      { id: 'd9', text: 'Tính khả thi của bài tập và đánh giá' },
      { id: 'd10', text: 'Tính đổi mới trong phương pháp dạy học' },
    ],
  },
  {
    id: 'industry',
    name: 'Doanh nghiệp / Nhà tuyển dụng / Chuyên gia thực tiễn',
    audience: 'Doanh nghiệp / Nhà tuyển dụng / Chuyên gia thực tiễn',
    goal: 'Đảm bảo sinh viên đáp ứng nhu cầu thực tế của thị trường lao động.',
    criteria: [
      { id: 'i1', text: 'Mức độ sát với nhu cầu nghề nghiệp thực tế' },
      { id: 'i2', text: 'Khả năng ứng dụng sau khi học' },
      { id: 'i3', text: 'Mức độ phát triển kỹ năng nghề nghiệp' },
      { id: 'i4', text: 'Tích hợp công cụ số và AI thực tiễn' },
      { id: 'i5', text: 'Kỹ năng làm việc nhóm và giao tiếp' },
      { id: 'i6', text: 'Kỹ năng phân tích dữ liệu và ra quyết định' },
      { id: 'i7', text: 'Năng lực giải quyết tình huống thực tế' },
      { id: 'i8', text: 'Mức độ sử dụng case study / doanh nghiệp thật' },
      { id: 'i9', text: 'Tính cập nhật xu hướng thị trường' },
      { id: 'i10', text: 'Khả năng giúp sinh viên sẵn sàng đi làm nhanh' },
    ],
  },
  {
    id: 'qa',
    name: 'Tổ chức kiểm định & đảm bảo chất lượng',
    audience: 'Tổ chức kiểm định & đảm bảo chất lượng',
    goal: 'Đảm bảo học phần đáp ứng chuẩn kiểm định trong và ngoài nước.',
    criteria: [
      { id: 'q1', text: 'CLO viết đúng chuẩn và đo lường được' },
      { id: 'q2', text: 'Ma trận CLO–PLO đầy đủ' },
      { id: 'q3', text: 'Alignment giữa CLO – hoạt động học – đánh giá' },
      { id: 'q4', text: 'Rubrics đánh giá rõ ràng' },
      { id: 'q5', text: 'Minh chứng đánh giá đầy đủ' },
      { id: 'q6', text: 'Tỷ trọng đánh giá hợp lý' },
      { id: 'q7', text: 'Chính sách học phần minh bạch' },
      { id: 'q8', text: 'Cơ chế cải tiến liên tục học phần (CQI)' },
      { id: 'q9', text: 'Hệ thống học liệu đầy đủ và cập nhật' },
      { id: 'q10', text: 'Tính nhất quán với tiêu chuẩn kiểm định như AUN-QA, ABET, MOET' },
    ],
  },
];

export function getGroup(id: CriterionGroupId): CriterionGroup {
  const g = CRITERIA_GROUPS.find((g) => g.id === id);
  if (!g) throw new Error(`Unknown group: ${id}`);
  return g;
}
